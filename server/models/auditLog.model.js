/**
 * auditLog.model.js — append-only tamper-evident trail.
 *
 * Chain rule: hash = SHA-256(prevHash + JSON of this entry).
 * The FIRST entry stores prevHash = 'GENESIS'; everyone after stores its
 * predecessor's hash. If any historical record is edited, its stored hash no
 * longer matches recomputation AND every later link breaks too — exactly the
 * effect the "Verify Integrity" button (Phase 4) must expose.
 */
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    // WHO did it
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String, enum: ['doctor', 'staff', 'admin', 'system'] },
    actorName: { type: String, trim: true },

    // WHAT happened (e.g. VISIT_VERSION_CREATED, PATIENT_UPDATED, ROLLBACK)
    action: { type: String, required: true, trim: true, index: true },
    entity: { type: String, required: true, trim: true }, // 'Patient', 'Visit', 'Auth'…
    entityId: { type: String, trim: true },
    details: { type: mongoose.Schema.Types.Mixed }, // small JSON summary, e.g. v1→v2
    ip: { type: String },

    // ---- hash chain ----
    prevHash: { type: String, required: true },
    hash: { type: String, required: true, unique: true },
    // Audited-at timestamp: part of the hash (see services/audit.service.js).
    // Kept separate from createdAt (the DB write time) so the hash can be
    // computed before the document ever exists.
    at: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // entries never change
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
