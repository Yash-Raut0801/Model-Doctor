import { Schema, model, Types } from 'mongoose';

// A Dataset = metadata about an uploaded CSV. The file itself stays on disk (databases are bad at big blobs;
// alt: S3/GridFS). Storing `path` lets the Python worker read the same file later via a shared Docker volume.
// A User = an account. We store a bcrypt HASH of the password, never the password itself.
export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true }, // unique index = DB-level duplicate protection
  password: { type: String, required: true },
}, { timestamps: true }));

export const Dataset = model('Dataset', new Schema({
  owner: { type: Types.ObjectId, ref: 'User', required: true, index: true }, // who owns this row
  name: String, path: String, columns: [String], rows: Number,
}, { timestamps: true })); // timestamps adds createdAt/updatedAt for free

// A Diagnosis = one "run". `status` is a tiny state machine: queued -> running -> done | failed.
// The UI polls this field; later the Python worker will be the one that updates it.
export const Diagnosis = model('Diagnosis', new Schema({
  dataset: { type: Types.ObjectId, ref: 'Dataset', required: true }, // ref = relation (like a foreign key)
  owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  target: { type: String, required: true },
  status: { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued' },
  result: Schema.Types.Mixed, // flexible shape: ML output will evolve, so we don't lock a schema yet
}, { timestamps: true }));

