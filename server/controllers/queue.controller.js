/**
 * queue.controller.js — today's waiting-room queue.
 *
 * Every write returns (and broadcasts) the same snapshot shape, so the staff
 * screen and the "Now Serving" board never drift:
 *   { data: [tokens], stats: { waiting, serving, done, active } }
 */
const HttpError = require('../utils/HttpError');
const QueueToken = require('../models/queueToken.model');
const Patient = require('../models/patient.model');
const { emitAudit } = require('../services/audit.service');
const { emitQueue } = require('../services/realtime.service');

/** 'YYYY-MM-DD' in local time — the queue day boundary. */
function dayKey(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Load today's tokens (oldest first) plus counters. */
async function snapshot() {
  const tokens = await QueueToken.find({ dayKey: dayKey() })
    .sort({ tokenNumber: 1 })
    .populate('patientId', 'fullName mrn')
    .populate('doctorId', 'name specialty');

  const data = tokens.map(t => ({
    id: t._id,
    tokenNumber: t.tokenNumber,
    status: t.status,
    note: t.note,
    calledAt: t.calledAt,
    completedAt: t.completedAt,
    patient: t.patientId
      ? { id: t.patientId._id, fullName: t.patientId.fullName, mrn: t.patientId.mrn }
      : null,
    doctor: t.doctorId ? { id: t.doctorId._id, name: t.doctorId.name } : null,
  }));

  const stats = {
    waiting: data.filter(t => t.status === 'waiting').length,
    serving: data.filter(t => t.status === 'serving').length,
    done: data.filter(t => t.status === 'done').length,
    active: data.filter(t => t.status === 'waiting' || t.status === 'serving').length,
  };

  return { data, stats };
}

/** GET /api/queue → today's queue. */
async function getQueue(req, res) {
  res.json({ success: true, ...(await snapshot()) });
}

/** POST /api/queue  { patientId, doctorId?, note? } → next token for today. */
async function addToken(req, res) {
  const patient = await Patient.findById(req.body.patientId).select('fullName mrn');
  if (!patient) throw new HttpError(404, 'Patient not found.');

  const key = dayKey();
  const last = await QueueToken.findOne({ dayKey: key })
    .sort({ tokenNumber: -1 })
    .select('tokenNumber');
  const tokenNumber = (last?.tokenNumber || 0) + 1;

  const token = await QueueToken.create({
    dayKey: key,
    tokenNumber,
    patientId: patient._id,
    doctorId: req.body.doctorId || patient.primaryDoctorId || undefined,
    note: req.body.note,
    createdBy: req.user.id,
  });

  emitAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.name,
    action: 'QUEUE_TOKEN_ADDED',
    entity: 'QueueToken',
    entityId: token._id.toString(),
    details: { tokenNumber, mrn: patient.mrn },
  });

  const body = await snapshot();
  emitQueue(body);
  res.status(201).json({ success: true, message: `Token ${tokenNumber} issued.`, ...body });
}

/** PATCH /api/queue/:id  { status } → move a token along. */
async function updateToken(req, res) {
  const token = await QueueToken.findById(req.params.id);
  if (!token) throw new HttpError(404, 'Queue token not found.');

  token.status = req.body.status;
  if (token.status === 'serving') token.calledAt = new Date();
  if (token.status === 'done' || token.status === 'skipped') token.completedAt = new Date();
  await token.save();

  emitAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.name,
    action: 'QUEUE_TOKEN_UPDATED',
    entity: 'QueueToken',
    entityId: token._id.toString(),
    details: { tokenNumber: token.tokenNumber, status: token.status },
  });

  const body = await snapshot();
  emitQueue(body);
  res.json({
    success: true,
    message: `Token ${token.tokenNumber} marked ${token.status}.`,
    ...body,
  });
}

module.exports = { getQueue, addToken, updateToken, snapshot, dayKey };
