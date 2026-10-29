/**
 * patient.model.js — one document per patient ("like a Git repository").
 */
const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    // Auto "chart number", e.g. MC-00017; assigned once on first save.
    mrn: { type: String, unique: true },
    fullName: { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: /^([6-9]\d{9})$/,
    },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''] },
    address: { type: String, trim: true },
    allergies: [{ type: String, trim: true }], // clinical data — hidden from staff
    primaryDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true, // age virtual
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

patientSchema.virtual('age').get(function virtualAge() {
  if (!this.dob) return null;
  const ms = Date.now() - new Date(this.dob).getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
});

/** Fill in the next MRN for new documents (seed + controller both call save). */
patientSchema.pre('save', async function assignMrn(next) {
  try {
    if (this.isNew && !this.mrn) {
      const Patient = mongoose.model('Patient');
      const count = await Patient.countDocuments();
      this.mrn = `MC-${String(count + 1).padStart(5, '0')}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

/** Rebuilds the patient doc as plain JSON. */
patientSchema.methods.toPatientJSON = function toPatientJSON({ includeClinical = true } = {}) {
  const json = this.toJSON();
  json.id = this._id; // expose plain `id` alongside `_id`
  // Staff (reception) must never receive clinical fields.
  if (!includeClinical) {
    delete json.allergies;
  }
  return json;
};

module.exports = mongoose.model('Patient', patientSchema);
