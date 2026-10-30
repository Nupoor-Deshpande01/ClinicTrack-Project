/**
 * prescription.model.js — medicines issued for ONE visit version.
 * The QR verification page (Phase 4) looks prescriptions up by qrToken.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dosage: {
      type: String,
      required: true,
      trim: true,
      match: /^\d+(\.\d+)?\s?(mg|ml|g|mcg|IU)$/i,
    },
    frequency: { type: String, required: true, trim: true }, // e.g. "1-0-1" or "twice daily"
    durationDays: { type: Number, required: true, min: 1, max: 180 },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    visitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    medicines: {
      type: [medicineSchema],
      validate: [arr => arr.length > 0, 'Prescription needs at least one medicine'],
    },
    advice: { type: String, trim: true, maxlength: 500 },
    // Public verification token for the QR code (Phase 4 PDF).
    qrToken: {
      type: String,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(16).toString('hex'),
    },
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

module.exports = mongoose.model('Prescription', prescriptionSchema);
