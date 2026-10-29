/**
 * visit.controller.js — Git-style versioned consultations.
 *
 * Core rule: PUT never mutates history — it inserts a new version document
 * (versionNumber+1, parentVisitId, changeReason, isCurrent=true) and flips
 * the previous current version's isCurrent to false.
 */
const HttpError = require('../utils/HttpError');
const Visit = require('../models/visit.model');
const Patient = require('../models/patient.model');
const { emitAudit } = require('../services/audit.service');

const EDITABLE_FIELDS = ['visitDate', 'diagnosis', 'symptoms', 'notes', 'vitals'];

/** Verify the patient exists and return it. */
async function requirePatient(patientId) {
  const patient = await Patient.findById(patientId);
  if (!patient) throw new HttpError(404, 'Patient not found.');
  return patient;
}

/** Collapse a Visit doc into the JSON the client renders. */
function visitJSON(v, extras = {}) {
  const json = v.toJSON();
  json.id = v._id;
  if (extras.patient) {
    json.patient = {
      id: extras.patient._id,
      fullName: extras.patient.fullName,
      mrn: extras.patient.mrn,
    };
  }
  return json;
}

/** Copy the mutable part of a visit into a new version document. */
function cloneVersion(source, overrides, byUserId) {
  const copy = {
    patientId: source.patientId,
    doctorId: byUserId,
    familyId: source.familyId || source._id,
    visitDate: source.visitDate,
    diagnosis: source.diagnosis,
    symptoms: [...(source.symptoms || [])],
    notes: source.notes,
    vitals: source.vitals ? { ...source.vitals } : undefined,
  };
  return new Visit({ ...copy, ...overrides, createdBy: byUserId });
}

/**
 * POST /api/patients/:id/visits  → create version 1 of a new visit.
 * body: { visitDate, diagnosis, symptoms, notes, vitals }
 */
async function createVisit(req, res) {
  const patient = await requirePatient(req.params.id);

  const visit = new Visit({
    patientId: patient._id,
    doctorId: req.user.id,
    visitDate: req.body.visitDate,
    diagnosis: req.body.diagnosis,
    symptoms: req.body.symptoms,
    notes: req.body.notes,
    vitals: req.body.vitals,
    createdBy: req.user.id,
  });
  await visit.save();
  visit.familyId = visit._id; // root of the version family — one extra cheap write
  await visit.save();

  emitAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.name,
    action: 'VISIT_CREATED',
    entity: 'Visit',
    entityId: visit._id.toString(),
    details: { patient: patient.mrn, diagnosis: visit.diagnosis },
  });

  res.status(201).json({
    success: true,
    message: `Visit recorded (version 1) for ${patient.fullName}.`,
    data: visitJSON(visit, { patient }),
  });
}

/** GET /api/patients/:id/visits → current visits + how versions each has. */
async function listVisits(req, res) {
  const patient = await requirePatient(req.params.id);
  const current = await Visit.find({ patientId: patient._id, isCurrent: true }).sort({
    visitDate: -1,
  });

  // Count versions per family in ONE query.
  const counts = await Visit.aggregate([
    { $match: { familyId: { $in: current.map(v => v.familyId) } } },
    { $group: { _id: '$familyId', total: { $sum: 1 } } },
  ]);
  const countByFamily = new Map(counts.map(c => [c._id.toString(), c.total]));

  res.json({
    success: true,
    data: current.map(v => ({
      ...visitJSON(v, { patient }),
      versionCount: countByFamily.get(v.familyId.toString()) || 1,
    })),
  });
}

/**
 * PUT /api/visits/:id  → "edit" = insert the NEXT version; history untouched.
 * body: { ...fields, changeReason } (changeReason is mandatory)
 */
async function updateVisit(req, res) {
  const current = await Visit.findById(req.params.id);
  if (!current) throw new HttpError(404, 'Visit not found.');
  if (!current.isCurrent) {
    throw new HttpError(
      409,
      'Only the CURRENT version can be edited — restore it first with rollback.'
    );
  }
  if (!req.body.changeReason || !String(req.body.changeReason).trim()) {
    throw new HttpError(422, 'changeReason is required when editing a visit.', [
      { field: 'changeReason', message: 'Tell future doctors what changed and why.' },
    ]);
  }

  const updates = EDITABLE_FIELDS.reduce((acc, key) => {
    if (req.body[key] !== undefined) acc[key] = req.body[key];
    return acc;
  }, {});
  if (Object.keys(updates).length === 0) {
    throw new HttpError(
      400,
      'Nothing to update: send at least one of visitDate, diagnosis, symptoms, notes, vitals.'
    );
  }

  const maxVersion = (
    await Visit.findOne({ familyId: current.familyId })
      .sort({ versionNumber: -1 })
      .select('versionNumber')
  ).versionNumber;
  const next = cloneVersion(current, updates, req.user.id);
  next.set({
    ...updates,
    versionNumber: maxVersion + 1,
    parentVisitId: current._id,
    changeReason: String(req.body.changeReason).trim(),
    isCurrent: true,
  });
  await next.save();
  current.isCurrent = false;
  await current.save();

  const patient = await requirePatient(current.patientId);
  emitAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.name,
    action: 'VISIT_VERSION_CREATED',
    entity: 'Visit',
    entityId: next._id.toString(),
    details: {
      patient: patient.mrn,
      fromVersion: current.versionNumber,
      toVersion: next.versionNumber,
      reason: next.changeReason,
      editedFields: Object.keys(updates),
    },
  });

  res.status(201).json({
    success: true,
    message: `New version v${next.versionNumber} stored — history of v${current.versionNumber} preserved.`,
    data: visitJSON(next, { patient }),
  });
}

/** GET /api/visits/:id/versions → the whole family, oldest first (timeline). */
async function listVersions(req, res) {
  const current = await Visit.findById(req.params.id).select('familyId isCurrent');
  if (!current) throw new HttpError(404, 'Visit not found.');
  const familyId = current.familyId || current._id;
  const versions = await Visit.find({ $or: [{ familyId }, { _id: familyId }] }).sort({
    versionNumber: 1,
  });
  const currentVersion = versions.find(v => v.isCurrent);
  res.json({
    success: true,
    message: `${versions.length} version(s) for visit family ${familyId}`,
    currentVersionId: currentVersion ? currentVersion._id : null,
    data: versions.map(v => visitJSON(v)),
  });
}

/** GET /api/visits/:a/diff/:b → side-by-side field comparison (spec endpoint). */
async function diffVisits(req, res) {
  const [a, b] = [await Visit.findById(req.params.a), await Visit.findById(req.params.b)];
  if (!a || !b) throw new HttpError(404, 'One or both visits not found.');
  if (!a.familyId === !b.familyId && String(a.patientId) !== String(b.patientId)) {
    throw new HttpError(400, 'Diff only works between versions of the same patient.');
  }

  const fields = [
    {
      key: 'visitDate',
      label: 'Visit date',
      get: v => (v.visitDate ? String(v.visitDate).slice(0, 10) : ''),
    },
    { key: 'diagnosis', label: 'Diagnosis' },
    { key: 'symptoms', label: 'Symptoms', get: v => (v.symptoms || []).join(', ') },
    { key: 'notes', label: 'Clinical notes' },
    { key: 'temperatureC', label: 'Temperature (°C)', get: v => v.vitals?.temperatureC },
    { key: 'bloodPressure', label: 'Blood pressure', get: v => v.vitals?.bloodPressure },
    { key: 'heartRate', label: 'Heart rate', get: v => v.vitals?.heartRate },
  ];
  const diff = fields.map(({ key, label, get }) => {
    const aVal = get ? get(a) : a[key];
    const bVal = get ? get(b) : b[key];
    return {
      field: key,
      label,
      a: aVal ?? '',
      b: bVal ?? '',
      changed: String(aVal ?? '') !== String(bVal ?? ''),
    };
  });

  res.json({
    success: true,
    message: `${diff.filter(d => d.changed).length} field(s) differ.`,
    data: { a: visitJSON(a), b: visitJSON(b), diff },
  });
}

/**
 * POST /api/visits/:id/rollback → insert a NEW version copying an older one.
 * body: { targetVisitId } — a non-current version of the same family,
 *       changeReason optional (defaults to "Rollback to version N").
 */
async function rollbackVisit(req, res) {
  const current = await Visit.findById(req.params.id);
  if (!current) throw new HttpError(404, 'Visit not found.');
  if (!current.isCurrent) {
    throw new HttpError(409, 'Rollback must start from the CURRENT version.');
  }

  const target = await Visit.findById(req.body.targetVisitId);
  if (!target || String(target.familyId) !== String(current.familyId)) {
    throw new HttpError(400, 'targetVisitId must be a version of the same visit family.');
  }
  if (target.isCurrent) throw new HttpError(400, 'Target version is already the current one.');

  const maxVersion = (
    await Visit.findOne({ familyId: current.familyId })
      .sort({ versionNumber: -1 })
      .select('versionNumber')
  ).versionNumber;
  const restored = cloneVersion(target, {}, req.user.id);
  restored.set({
    versionNumber: maxVersion + 1,
    parentVisitId: current._id,
    changeReason: req.body.changeReason?.trim() || `Rollback to version ${target.versionNumber}`,
    isCurrent: true,
    rollbackOf: target._id,
  });
  await restored.save();
  current.isCurrent = false;
  await current.save();

  const patient = await requirePatient(current.patientId);
  emitAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.name,
    action: 'VISIT_ROLLBACK',
    entity: 'Visit',
    entityId: restored._id.toString(),
    details: {
      patient: patient.mrn,
      rollbackFrom: target.versionNumber,
      newVersion: restored.versionNumber,
    },
  });

  res.status(201).json({
    success: true,
    message: `Restored version ${target.versionNumber} as new version v${restored.versionNumber} — original versions all preserved.`,
    data: visitJSON(restored, { patient }),
  });
}

module.exports = { createVisit, listVisits, updateVisit, listVersions, diffVisits, rollbackVisit };
