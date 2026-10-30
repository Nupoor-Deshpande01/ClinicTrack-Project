/**
 * audit.controller.js — read the trail and prove it was not tampered with.
 *
 * verifyChain() rebuilds every hash from the stored data:
 *   hash[n] === SHA-256(hash[n-1] + JSON(payload[n]))
 * If any historical entry was edited (or deleted), the first mismatch is
 * reported together with its position, action and expected/actual hash.
 */
const AuditLog = require('../models/auditLog.model');
const { auditPayload, computeHash } = require('../services/audit.service');

/** GET /api/audit?page=&limit=&action= → newest first. */
async function listAudit(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const filter = {};
  if (req.query.action) filter.action = new RegExp(String(req.query.action).trim(), 'i');
  if (req.query.entity) filter.entity = req.query.entity;

  const [total, docs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.json({
    success: true,
    data: docs.map(d => ({
      id: d._id,
      at: d.at,
      actorName: d.actorName || 'system',
      actorRole: d.actorRole,
      action: d.action,
      entity: d.entity,
      entityId: d.entityId,
      details: d.details,
      prevHash: d.prevHash,
      hash: d.hash,
    })),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

/** GET /api/audit/verify → { valid, checked, firstBroken? } */
async function verifyAudit(req, res) {
  // Oldest first: the chain is built in insertion order.
  const entries = await AuditLog.find({}).sort({ createdAt: 1, _id: 1 }).lean();

  let prevHash = 'GENESIS';
  for (const [index, entry] of entries.entries()) {
    const expected = computeHash(prevHash, auditPayload(entry));
    if (entry.prevHash !== prevHash || entry.hash !== expected) {
      return res.status(200).json({
        success: true,
        message: `Chain broken at entry ${index + 1} (${entry.action}).`,
        data: {
          valid: false,
          checked: index + 1,
          total: entries.length,
          firstBroken: {
            position: index + 1,
            id: entry._id,
            at: entry.at,
            action: entry.action,
            entity: entry.entity,
            expectedHash: expected,
            storedHash: entry.hash,
            expectedPrevHash: prevHash,
            storedPrevHash: entry.prevHash,
          },
        },
      });
    }
    prevHash = entry.hash;
  }

  res.json({
    success: true,
    message: `All ${entries.length} entries verified.`,
    data: { valid: true, checked: entries.length, total: entries.length },
  });
}

module.exports = { listAudit, verifyAudit };
