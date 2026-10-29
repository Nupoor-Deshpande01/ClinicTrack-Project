/**
 * audit.service.js — tamper-evident audit trail built from Node core modules:
 *  - crypto : SHA-256 chain hashing
 *  - events : an EventEmitter so any module can emit an audit event without
 *             importing controllers or model details.
 *
 * Usage from anywhere:
 *   const { emitAudit } = require('../services/audit.service');
 *   emitAudit({ actorId: req.user.id, actorRole: req.user.role, action: 'PATIENT_CREATED', ... });
 */
const crypto = require('crypto');
const events = require('events');
const AuditLog = require('../models/auditLog.model');

/** EventEmitter shared by the whole server. */
const auditBus = new events.EventEmitter();

/** The canonical payload that goes into the hash. Keep it in ONE place so
 *  writers and (Phase 4) the verifier compute byte-identical strings. */
function auditPayload(doc) {
  return {
    action: doc.action,
    entity: doc.entity,
    entityId: doc.entityId,
    actorId: doc.actorId,
    at: doc.at, // audited-at timestamp, set by us (NOT the DB-generated createdAt)
    details: doc.details,
  };
}

/** hash = SHA-256(prevHash + canonical JSON of the entry). */
function computeHash(prevHash, payload) {
  return crypto
    .createHash('sha256')
    .update(prevHash + JSON.stringify(payload))
    .digest('hex');
}

// Write queue: chain writes must be sequential (each needs the previous hash),
// so a simple promise chain serializes them.
let writeChain = Promise.resolve();

function writeOne(entry) {
  const { actorId, actorRole, actorName, action, entity, entityId, details, ip } = entry;

  return (async () => {
    const last = await AuditLog.findOne({}).sort({ createdAt: -1, _id: -1 }).select('hash');
    const prevHash = last ? last.hash : 'GENESIS';

    // The hash covers OUR timestamp, not the DB's createdAt — a document's
    // hash must be computable BEFORE it exists (see auditPayload()).
    const at = new Date();
    const doc = await AuditLog.create({
      actorId,
      actorRole,
      actorName,
      action,
      entity,
      entityId,
      details,
      ip,
      at,
      prevHash,
      hash: computeHash(
        prevHash,
        auditPayload({
          action,
          entity,
          entityId,
          actorId,
          at,
          details,
        })
      ),
    });
    return doc;
  })();
}

/** Queue one audit entry. Internal use — call emitAudit() instead. */
function enqueue(entry) {
  writeChain = writeChain
    .then(() => writeOne(entry))
    .catch(err => console.error('audit write failed:', err.message));
}

auditBus.on('audit', enqueue);

/** Fire an audit event (non-blocking, as befits a trail: failures never break request handling). */
function emitAudit(entry) {
  auditBus.emit('audit', entry);
}

module.exports = { auditBus, computeHash, emitAudit, auditPayload };
