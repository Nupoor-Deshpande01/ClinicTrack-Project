/**
 * patient.controller.js — patient CRUD.
 *
 * Role rules kept here (so we can replace the storage engine someday without
 * breaking them):
 *  - staff (reception) may list/read/create demographics but NEVER receives
 *    clinical fields (allergies) — see toPatientJSON({ includeClinical }).
 *  - only doctor/admin update patient records.
 */
const HttpError = require('../utils/HttpError');
const Patient = require('../models/patient.model');
const { emitAudit } = require('../services/audit.service');

const isClinicalRole = role => role === 'doctor' || role === 'admin';

/** GET /api/patients?search=&gender=&page=&limit= → paginated list. */
async function listPatients(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const filter = {};

  if (req.query.search) {
    const q = String(req.query.search).trim();
    filter.$or = [
      { fullName: new RegExp(q, 'i') },
      { mrn: new RegExp(q, 'i') },
      { phone: new RegExp(q, 'i') },
    ];
  }
  if (['male', 'female', 'other'].includes(req.query.gender)) {
    filter.gender = req.query.gender;
  }

  const [total, docs] = await Promise.all([
    Patient.countDocuments(filter),
    Patient.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  // List responses carry clinical data only for clinical roles.
  res.json({
    success: true,
    message: `${docs.length} patient(s) found`,
    data: docs.map(p => p.toPatientJSON({ includeClinical: isClinicalRole(req.user.role) })),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

/** GET /api/patients/:id → one patient (fields trimmed for staff). */
async function getPatient(req, res) {
  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new HttpError(404, 'Patient not found.');

  res.json({
    success: true,
    data: patient.toPatientJSON({ includeClinical: isClinicalRole(req.user.role) }),
  });
}

/** POST /api/patients → register. Server returns a duplicate-phone WARNING flag. */
async function createPatient(req, res) {
  const body = req.body;
  const patient = new Patient(body);
  patient.createdBy = req.user.id;
  if (isClinicalRole(req.user.role) && !patient.primaryDoctorId) {
    patient.primaryDoctorId = req.user.id;
  }
  await patient.save();

  // Duplicate warning (client also warns live — this is the server's, authoritative):
  const duplicate = await Patient.findOne({
    phone: patient.phone,
    _id: { $ne: patient._id },
  }).lean();
  emitAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.name,
    action: 'PATIENT_CREATED',
    entity: 'Patient',
    entityId: patient._id.toString(),
    details: {
      mrn: patient.mrn,
      name: patient.fullName,
      duplicatePhone: duplicate ? duplicate.mrn : null,
    },
  });

  res.status(201).json({
    success: true,
    message: duplicate
      ? `Patient saved — note: same mobile number already belongs to patient ${duplicate.mrn} (${duplicate.fullName}).`
      : `Patient ${patient.mrn} registered.`,
    data: patient.toPatientJSON(),
    warnings: duplicate
      ? [
          {
            field: 'phone',
            message: `Duplicate mobile number shared with ${duplicate.mrn} · ${duplicate.fullName}.`,
          },
        ]
      : undefined,
  });
}

/** PUT /api/patients/:id → edit demographics. Clinical roles only. */
async function updatePatient(req, res) {
  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new HttpError(404, 'Patient not found.');

  const editable = ['fullName', 'phone', 'dob', 'gender', 'bloodGroup', 'address', 'allergies'];
  const clinicalOnly = ['allergies'];
  const changes = {};
  for (const key of editable) {
    if (req.body[key] !== undefined) {
      // Staff edits demographics; allergy edits are clinical work.
      if (clinicalOnly.includes(key) && !isClinicalRole(req.user.role)) {
        throw new HttpError(403, 'Reception staff cannot edit clinical fields (allergies).');
      }
      changes[key] = req.body[key];
    }
  }
  Object.assign(patient, changes);
  await patient.save();

  emitAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.name,
    action: 'PATIENT_UPDATED',
    entity: 'Patient',
    entityId: patient._id.toString(),
    details: { fields: Object.keys(changes) },
  });

  res.json({
    success: true,
    message: `Patient ${patient.mrn} updated.`,
    data: patient.toPatientJSON({ includeClinical: isClinicalRole(req.user.role) }),
  });
}

module.exports = { listPatients, getPatient, createPatient, updatePatient };
