/**
 * export.controller.js — backups built with Node core modules:
 *   fs     : the JSON backup is written to server/backups, streamed, then deleted
 *   path   : safe, portable file location
 *   stream : fs.createReadStream piped into the HTTP response (no full buffer
 *            copy in memory for the download)
 *
 * Both endpoints are admin-only: the backup contains clinical data.
 */
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const Patient = require('../models/patient.model');
const Visit = require('../models/visit.model');
const Prescription = require('../models/prescription.model');
const Appointment = require('../models/appointment.model');
const AuditLog = require('../models/auditLog.model');
const QueueToken = require('../models/queueToken.model');
const User = require('../models/user.model');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/** Write a text file, stream it to the client, then remove it. */
async function streamFile(res, filePath, filename, contentType) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  try {
    await pipeline(fs.createReadStream(filePath), res);
  } finally {
    fs.promises.unlink(filePath).catch(() => {});
  }
}

/** GET /api/export/backup → full JSON backup (users without password hashes). */
async function exportBackup(req, res, next) {
  try {
    const [patients, visits, prescriptions, appointments, queue, audit, users] = await Promise.all([
      Patient.find({}).lean(),
      Visit.find({}).lean(),
      Prescription.find({}).lean(),
      Appointment.find({}).lean(),
      QueueToken.find({}).lean(),
      AuditLog.find({}).sort({ createdAt: 1 }).lean(),
      User.find({}).select('-password').lean(),
    ]);

    const payload = {
      clinic: 'CityCare Clinic',
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.name,
      counts: {
        patients: patients.length,
        visits: visits.length,
        prescriptions: prescriptions.length,
        appointments: appointments.length,
        queueTokens: queue.length,
        auditEntries: audit.length,
        users: users.length,
      },
      data: { patients, visits, prescriptions, appointments, queue, audit, users },
    };

    await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
    const filePath = path.join(BACKUP_DIR, `clinictrack-backup-${stamp()}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');

    await streamFile(res, filePath, path.basename(filePath), 'application/json; charset=utf-8');
  } catch (err) {
    next(err);
  }
}

/** GET /api/export/patients.csv → CSV export (Excel-friendly quoting). */
async function exportPatientsCsv(req, res, next) {
  try {
    const patients = await Patient.find({}).sort({ mrn: 1 }).lean();
    const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['MRN', 'Full name', 'Phone', 'DOB', 'Gender', 'Blood group', 'Allergies'];
    const rows = patients.map(p => [
      p.mrn,
      p.fullName,
      p.phone,
      p.dob ? new Date(p.dob).toISOString().slice(0, 10) : '',
      p.gender,
      p.bloodGroup || '',
      (p.allergies || []).join('; '),
    ]);
    const csv = [header, ...rows].map(r => r.map(escape).join(',')).join('\r\n');

    await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
    const filePath = path.join(BACKUP_DIR, `patients-${stamp()}.csv`);
    await fs.promises.writeFile(filePath, csv, 'utf8');

    await streamFile(res, filePath, path.basename(filePath), 'text/csv; charset=utf-8');
  } catch (err) {
    next(err);
  }
}

module.exports = { exportBackup, exportPatientsCsv };
