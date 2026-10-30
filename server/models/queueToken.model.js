/**
 * queueToken.model.js — one waiting-room token per patient visit today.
 *
 * Tokens are numbered per day (1, 2, 3 …) and move through a small state
 * machine: waiting → serving → done (or skipped). The queue screen and the
 * "Now Serving" board both read this collection; live updates are broadcast
 * over Socket.IO (services/realtime.service.js).
 */
const mongoose = require('mongoose');

const queueTokenSchema = new mongoose.Schema(
  {
    // Which clinic day this token belongs to, 'YYYY-MM-DD' — numbering restarts daily.
    dayKey: { type: String, required: true, index: true },
    tokenNumber: { type: Number, required: true, min: 1 },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['waiting', 'serving', 'done', 'skipped'],
      default: 'waiting',
      index: true,
    },
    note: { type: String, trim: true, maxlength: 120 },
    calledAt: Date,
    completedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// No two tokens share a number on the same day.
queueTokenSchema.index({ dayKey: 1, tokenNumber: 1 }, { unique: true });

module.exports = mongoose.model('QueueToken', queueTokenSchema);
