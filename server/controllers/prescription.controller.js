/**
 * prescription.controller.js — create, read, print and publicly verify
 * prescriptions.
 *
 * The PDF (pdfkit) carries the clinic letterhead and a QR code pointing at
 * /verify/:qrToken on the React app; that page asks the public endpoint below
 * for a tamper-checked summary of the same prescription.
 */
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const HttpError = require('../utils/HttpError');
const Prescription = require('../models/prescription.model');
const Visit = require('../models/visit.model');
const Patient = require('../models/patient.model');
const User = require('../models/user.model');
const { emitAudit } = require('../services/audit.service');

const CLINIC = {
  name: 'CityCare Clinic',
  line: 'Plot 12, Sector 24, Nigdi, Pune 411044 · +91 20 4000 1200',
  reg: 'Reg. No. MH-PN-2213 · Digital Prescription Record',
};

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

/** GET /api/prescriptions?limit= → newest prescriptions with patient/doctor names. */
async function listRecent(req, res) {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const docs = await Prescription.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('patientId', 'fullName mrn')
    .populate('doctorId', 'name specialty');

  res.json({
    success: true,
    data: docs.map(rx => ({
      id: rx._id,
      createdAt: rx.createdAt,
      qrToken: rx.qrToken,
      medicines: rx.medicines,
      advice: rx.advice,
      patient: rx.patientId
        ? { id: rx.patientId._id, fullName: rx.patientId.fullName, mrn: rx.patientId.mrn }
        : null,
      doctor: rx.doctorId ? { id: rx.doctorId._id, name: rx.doctorId.name } : null,
    })),
  });
}

/** GET /api/prescriptions/:id/pdf → A5 prescription with letterhead + QR. */
async function prescriptionPdf(req, res) {
  const rx = await Prescription.findById(req.params.id);
  if (!rx) throw new HttpError(404, 'Prescription not found.');

  const [patient, doctor, visit] = await Promise.all([
    Patient.findById(rx.patientId).select('fullName mrn dob gender'),
    User.findById(rx.doctorId).select('name specialty'),
    Visit.findById(rx.visitId).select('diagnosis visitDate versionNumber'),
  ]);

  const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify/${rx.qrToken}`;
  const qrPng = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 150 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="prescription-${rx._id}.pdf"`);

  const doc = new PDFDocument({ size: 'A5', margin: 32 });
  doc.on('error', err => res.destroy(err));
  doc.pipe(res);

  // ---- letterhead ----
  doc.rect(0, 0, doc.page.width, 76).fill('#2563EB');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16).text(CLINIC.name, 32, 20);
  doc.font('Helvetica').fontSize(8).fillColor('#EAF2FF').text(CLINIC.line, 32, 42);
  doc.fillColor('#EAF2FF').fontSize(7).text(CLINIC.reg, 32, 55);

  // ---- patient / visit block ----
  let y = 92;
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(11).text('Prescription', 32, y);
  y += 18;
  doc.font('Helvetica').fontSize(9);
  const age = patient?.dob ? Math.floor((Date.now() - patient.dob) / 3.156e10) : '-';
  doc.text(`Patient: ${patient?.fullName ?? '—'} (${patient?.mrn ?? '—'})`, 32, y);
  doc.text(`Age / Gender: ${age} / ${patient?.gender ?? '—'}`, 300, y);
  y += 14;
  doc.text(
    `Date: ${new Date(rx.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })}`,
    32,
    y
  );
  doc.text(`Diagnosis: ${visit?.diagnosis ?? '—'}`, 300, y);
  y += 14;
  doc.text(`Prescribed by: Dr. ${doctor?.name ?? '—'} (${doctor?.specialty ?? 'General'})`, 32, y);

  // ---- medicine table ----
  y += 22;
  const cols = [32, 190, 280, 350];
  doc.rect(32, y, 331, 18).fill('#EAF2FF');
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8);
  doc.text('Medicine', cols[0] + 6, y + 5);
  doc.text('Dosage', cols[1], y + 5);
  doc.text('Frequency', cols[2], y + 5);
  doc.text('Days', cols[3], y + 5);
  y += 18;

  doc.font('Helvetica').fontSize(8);
  rx.medicines.forEach((m, i) => {
    if (i % 2 === 1) doc.rect(32, y, 331, 16).fill('#F8FAFC');
    doc.fillColor('#0F172A');
    doc.text(m.name, cols[0] + 6, y + 4, { width: 150 });
    doc.text(m.dosage, cols[1], y + 4);
    doc.text(m.frequency, cols[2], y + 4);
    doc.text(String(m.durationDays), cols[3], y + 4);
    y += 16;
  });

  // ---- advice + QR ----
  y += 12;
  if (rx.advice) {
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8).text('Advice', 32, y);
    doc.font('Helvetica').fontSize(8).fillColor('#334155');
    doc.text(rx.advice, 32, y + 12, { width: 210 });
  }

  doc.image(qrPng, 292, y - 4, { width: 74 });
  doc
    .fontSize(6)
    .fillColor('#64748B')
    .text('Scan to verify this prescription', 280, y + 72, { width: 90, align: 'center' });

  doc
    .fontSize(6)
    .fillColor('#94A3B8')
    .text(
      'Digitally generated by ClinicTrack. Demonstration data — not a real medical document.',
      32,
      doc.page.height - 24,
      { width: 331, align: 'center' }
    );

  doc.end();
}

/** GET /api/prescriptions/verify/:qrToken (public) → what a QR scan shows. */
async function verifyPrescription(req, res) {
  const rx = await Prescription.findOne({ qrToken: req.params.qrToken })
    .populate('patientId', 'fullName mrn')
    .populate('doctorId', 'name specialty');

  if (!rx) throw new HttpError(404, 'No prescription matches this QR code.');

  res.json({
    success: true,
    message: 'Prescription verified.',
    data: {
      valid: true,
      clinic: CLINIC.name,
      issuedAt: rx.createdAt,
      patient: rx.patientId ? { fullName: rx.patientId.fullName, mrn: rx.patientId.mrn } : null,
      doctor: rx.doctorId ? { name: rx.doctorId.name, specialty: rx.doctorId.specialty } : null,
      medicines: rx.medicines,
      advice: rx.advice,
    },
  });
}

module.exports = {
  createPrescription,
  listForVisit,
  listRecent,
  prescriptionPdf,
  verifyPrescription,
};
