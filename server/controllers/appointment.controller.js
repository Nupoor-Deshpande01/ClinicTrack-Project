/**
 * appointment.controller.js — dashboard appointment list + create/delete.
 */
const HttpError = require('../utils/HttpError');
const Appointment = require('../models/appointment.model');
const Patient = require('../models/patient.model');
const { emitAudit } = require('../services/audit.service');

/** "YYYY-MM-DD" → { start, end } of that local day. */
function dayRange(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end };
}

/** GET /api/appointments?date=YYYY-MM-DD (defaults to today). */
async function listAppointments(req, res) {
  const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new HttpError(400, 'date must be YYYY-MM-DD');
  const { start, end } = dayRange(dateStr);

  const appointments = await Appointment.find({ scheduledAt: { $gte: start, $lte: end } })
    .populate('patientId', 'fullName mrn phone')
    .populate('doctorId', 'name specialty')
    .sort({ scheduledAt: 1 });

  res.json({
    success: true,
    data: appointments.map(a => ({
      id: a._id,
      scheduledAt: a.scheduledAt,
      time: a.scheduledAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      status: a.status,
      disease: a.disease,
      patient: a.patientId
        ? { id: a.patientId._id, fullName: a.patientId.fullName, mrn: a.patientId.mrn }
        : null,
      doctor: a.doctorId
        ? { id: a.doctorId._id, name: a.doctorId.name, specialty: a.doctorId.specialty }
        : null,
    })),
    meta: { date: dateStr, count: appointments.length },
  });
}

/** POST /api/appointments  { patientId, doctorId, scheduledAt, disease } */
async function createAppointment(req, res) {
  const patient = await Patient.findById(req.body.patientId);
  if (!patient) throw new HttpError(404, 'Patient not found.');

  const appointment = await Appointment.create({
    patientId: patient._id,
    doctorId: req.body.doctorId,
    scheduledAt: req.body.scheduledAt,
    disease: req.body.disease,
    createdBy: req.user.id,
  });

  emitAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.name,
    action: 'APPOINTMENT_CREATED',
    entity: 'Appointment',
    entityId: appointment._id.toString(),
    details: { patient: patient.mrn, at: appointment.scheduledAt },
  });

  const { emitAppointment } = require('../services/realtime.service');
  emitAppointment({ appointment, patient });

  res
    .status(201)
    .json({ success: true, message: 'Appointment booked.', data: { id: appointment._id } });
}

/** DELETE /api/appointments/:id — booking mistakes happen; removal is audited. */
async function deleteAppointment(req, res) {
  const appointment = await Appointment.findByIdAndDelete(req.params.id);
  if (!appointment) throw new HttpError(404, 'Appointment not found.');

  emitAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.name,
    action: 'APPOINTMENT_DELETED',
    entity: 'Appointment',
    entityId: req.params.id,
    details: { scheduledAt: appointment.scheduledAt },
  });

  const { emitAppointment } = require('../services/realtime.service');
  emitAppointment({ deletedId: req.params.id });

  res.json({ success: true, message: 'Appointment removed.' });
}

module.exports = { listAppointments, createAppointment, deleteAppointment };
