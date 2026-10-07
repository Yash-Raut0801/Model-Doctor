import { Router } from 'express';
import multer from 'multer'; // handles multipart/form-data (file uploads); express.json can't
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod'; // runtime validation: TypeScript types vanish at runtime, Zod checks real incoming data
import { Dataset, Diagnosis } from './models.js'; // ESM requires the .js extension on local imports
import { protect } from './middleware.js';

// ESM has no __dirname, so we rebuild it from import.meta.url (the current file's URL)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
router.use(protect); // every route below now requires a valid login token

const diagnoseSchema = z.object({
  datasetId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid dataset id'), // a MongoDB ObjectId is 24 hex chars
  target: z.string().min(1, 'Choose a target column'),
});

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'uploads'),
    // Prefix with a timestamp so two files named data.csv never overwrite each other.
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, '_')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB cap protects the server from huge uploads
  fileFilter: (_req, file, cb) => cb(file.originalname.toLowerCase().endsWith('.csv') ? null : new Error('Upload a .csv file'), true),
});

// --- Datasets ---------------------------------------------------------------
router.post('/datasets', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file received' });
    const lines = fs.readFileSync(req.file.path, 'utf8').split(/\r?\n/).filter(Boolean);
    // Header = first line. Naive split(',') is fine for a skeleton; real CSVs with quoted commas
    // need a parser (alt: csv-parse, papaparse).
    const columns = lines[0].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (columns.length < 2 || lines.length < 20) return res.status(422).json({ message: 'Need 2+ columns and 20+ rows' });
    const ds = await Dataset.create({ owner: req.user._id, name: req.file.originalname, path: req.file.path, columns, rows: lines.length - 1 });
    res.status(201).json(ds);
  } catch (e) { next(e); }
});

router.get('/datasets', async (req, res, next) => {
  try { res.json(await Dataset.find({ owner: req.user._id }).sort({ createdAt: -1 })); } catch (e) { next(e); }
});

// --- Diagnoses --------------------------------------------------------------
router.post('/diagnoses', async (req, res, next) => {
  try {
    const parsed = diagnoseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
    const { datasetId, target } = parsed.data;
    // Ownership check: querying by BOTH _id and owner means you can't use someone else's dataset by guessing its id.
    const ds = await Dataset.findOne({ _id: datasetId, owner: req.user._id });
    if (!ds) return res.status(404).json({ message: 'Dataset not found' });
    if (!ds.columns.includes(target)) return res.status(400).json({ message: 'Target must be a column of the dataset' });
    const dx = await Diagnosis.create({ owner: req.user._id, dataset: ds._id, target });
    runMock(dx._id);      // NOT awaited on purpose: respond now (202-style), work continues in background
    res.status(201).json(dx); // Phase 3 replaces runMock with: push job to Redis for the Python worker
  } catch (e) { next(e); }
});

router.get('/diagnoses/:id', async (req, res, next) => {
  try {
    const dx = await Diagnosis.findOne({ _id: req.params.id, owner: req.user._id });
    dx ? res.json(dx) : res.status(404).json({ message: 'Not found' });
  } catch (e) { next(e); }
});

// --- MOCK worker (temporary) -------------------------------------------------
// Returns learning curves like the real worker will. Each curve = score at 10%..100% of the training data.
const SIZES = [10, 20, 40, 60, 80, 100];
const SCENARIOS = [
  { train: [.99, .97, .96, .95, .95, .94], dev: [.55, .62, .66, .68, .69, .70] }, // big gap  -> variance
  { train: [.66, .64, .63, .62, .62, .62], dev: [.52, .57, .59, .60, .61, .61] }, // both low -> bias
  { train: [.93, .91, .90, .90, .89, .89], dev: [.74, .80, .84, .86, .87, .88] }, // converge -> good
];
const FIXES = {
  'high-bias': ['Use a bigger model (more layers/units)', 'Add or engineer more features', 'Reduce regularization (lower lambda)', 'Train longer'],
  'high-variance': ['Collect more training data', 'Increase regularization (higher lambda)', 'Try a smaller model or fewer features', 'Add dropout'],
  'good-fit': ['Try error analysis on the worst predictions', 'Tune hyperparameters on the dev set', 'Compare tree models (XGBoost) with your network'],
};
// Andrew Ng's rule of thumb: low TRAIN score => bias; big TRAIN-DEV gap => variance.
function diagnose(train, dev) {
  if (train < 0.8) return 'high-bias';
  return train - dev > 0.1 ? 'high-variance' : 'good-fit';
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function runMock(id) {
  try {
    await Diagnosis.findByIdAndUpdate(id, { status: 'running' });
    await sleep(3000); // pretend to train
    const s = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    const curve = SIZES.map((size, i) => ({ size, train: s.train[i], dev: s.dev[i] }));
    const verdict = diagnose(s.train.at(-1), s.dev.at(-1));
    await Diagnosis.findByIdAndUpdate(id, { status: 'done', result: { verdict, curve, fixes: FIXES[verdict] } });
  } catch { await Diagnosis.findByIdAndUpdate(id, { status: 'failed' }); }
}

export default router;
