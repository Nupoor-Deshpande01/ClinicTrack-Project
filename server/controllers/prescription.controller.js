/**
 * prescription.controller.js — Phase 3: create & read prescriptions.
 * PDF + public QR verification arrive in Phase 4 (wow feature 4).
 */
const HttpError = require('../utils/HttpError');
const Prescription = require('../models/prescription.model');
const Visit = require('../models/visit.model');
const { emitAudit } = require('../services/audit.service');

/** POST /api/visits/:id/prescription — attach medicines to the CURRENT visit version. */
async function createPrescription(req, res) {
  const visit = await Visit.findById(req.params.id);
  if (!visit) throw new HttpError(404, 'Visit not found.');
  if (!visit.isCurrent)
    throw new HttpError(409, 'Prescriptions can only be written on the current visit version.');

  const prescription = await Prescription.create({
    visitId: visit._id,
    patientId: visit.patientId,
    doctorId: req.user.id,
    medicines: req.body.medicines,
    advice: req.body.advice,
  });

  emitAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.name,
    action: 'PRESCRIPTION_CREATED',
    entity: 'Prescription',
    entityId: prescription._id.toString(),
    details: { visitId: visit._id.toString(), medicines: prescription.medicines.length },
  });

  res.status(201).json({ success: true, message: 'Prescription saved.', data: prescription });
}

/** GET /api/visits/:id/prescriptions → prescriptions written for this visit. */
async function listForVisit(req, res) {
  const prescriptions = await Prescription.find({ visitId: req.params.id }).sort({ createdAt: -1 });
  res.json({ success: true, data: prescriptions });
}

module.exports = { createPrescription, listForVisit };
