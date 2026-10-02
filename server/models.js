const { Schema, model, Types } = require('mongoose');

// A Dataset = metadata about an uploaded CSV. The file itself stays on disk (databases are bad at big blobs;
// alt: S3/GridFS). Storing `path` lets the Python worker read the same file later via a shared Docker volume.
const Dataset = model('Dataset', new Schema({
  name: String, path: String, columns: [String], rows: Number,
}, { timestamps: true })); // timestamps adds createdAt/updatedAt for free

// A Diagnosis = one "run". `status` is a tiny state machine: queued -> running -> done | failed.
// The UI polls this field; later the Python worker will be the one that updates it.
const Diagnosis = model('Diagnosis', new Schema({
  dataset: { type: Types.ObjectId, ref: 'Dataset', required: true }, // ref = relation (like a foreign key)
  target: { type: String, required: true },
  status: { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued' },
  result: Schema.Types.Mixed, // flexible shape: ML output will evolve, so we don't lock a schema yet
}, { timestamps: true }));

module.exports = { Dataset, Diagnosis };
