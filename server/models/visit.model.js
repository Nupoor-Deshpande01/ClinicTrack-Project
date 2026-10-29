/**
 * visit.model.js — one version of one consultation ("like a Git commit").
 *
 * Versioning rules enforced by the controllers (never by mutating docs):
 *  - version 1: created by POST /api/patients/:id/visits
 *      { versionNumber: 1, familyId: self._id, parentVisitId: null, isCurrent: true }
 *  - every later "edit" inserts a NEW document:
 *      { versionNumber: prev+1, parentVisitId: prev._id, isCurrent: true,
 *        changeReason: required }, and the previous version gets isCurrent: false.
 *  - rollback copies an older version into a new document the same way,
 *      so history is append-only and tamper-evident by construction.
 */
const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema(
  {
    // Which patient this visit belongs to (indexed: the dashboard's main query)
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    // Doctor who recorded the visit
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    visitDate: { type: Date, required: true },
    diagnosis: { type: String, required: true, trim: true },
    symptoms: [{ type: String, trim: true }],
    notes: { type: String, trim: true }, // clinical notes — reception never sees this
    vitals: {
      temperatureC: Number,
      bloodPressure: { type: String, match: /^\d{2,3}\/\d{2,3}$/ }, // "120/80"
      heartRate: Number,
    },

    // A visit's whole history (all versions) shares one familyId — the root doc's _id.
    familyId: { type: mongoose.Schema.Types.ObjectId, index: true },

    // ---- versioning fields (see header) ----
    versionNumber: { type: Number, default: 1, required: true },
    parentVisitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', default: null },
    isCurrent: { type: Boolean, default: true, index: true },
    changeReason: { type: String, trim: true }, // what changed and why (v2 onward)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rollbackOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' }, // set on rollback copies
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

// Fast lookups for "current visits of one patient" (dashboard, patient profile)
visitSchema.index({ patientId: 1, isCurrent: 1 });

module.exports = mongoose.model('Visit', visitSchema);
