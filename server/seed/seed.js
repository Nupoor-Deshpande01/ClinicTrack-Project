/**
 * seed.js — dummy data for the ClinicTrack demo (all data is invented).
 *
 * Creates:
 *  - 4 users: 1 admin, 2 doctors, 1 reception
 *  - 30 patients with Indian names, MRNs, DOBs, phones and a few allergies
 *  - 1-3 visits per patient; one visit is revised (v2) for 6 of them and
 *    rolled into a v3 for 2, so the timeline/diff views have material.
 *
 * Run:  npm run seed   (or)  node seed/seed.js   (reads server/.env)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Patient = require('../models/patient.model');
const Visit = require('../models/visit.model');
const AuditLog = require('../models/auditLog.model');
const Appointment = require('../models/appointment.model');
const Prescription = require('../models/prescription.model');
const QueueToken = require('../models/queueToken.model');

const FIRST = [
  'Aarav',
  'Vivaan',
  'Aditya',
  'Siddharth',
  'Rohit',
  'Kabir',
  'Rahul',
  'Nikhil',
  'Arjun',
  'Rajesh',
  'Aarohi',
  'Saanvi',
  'Diya',
  'Ananya',
  'Ishita',
  'Meera',
  'Kavya',
  'Priya',
  'Rhea',
  'Sneha',
];
const LAST = [
  'Deshmukh',
  'Kulkarni',
  'Pawar',
  'Patil',
  'Jadhav',
  'Shinde',
  'Joshi',
  'Bhosale',
  'Ghule',
  'Nikam',
];
const DIAGNOSES = [
  { diagnosis: 'Acute viral fever', symptoms: ['fever', 'body ache'], meds: ['paracetamol'] },
  { diagnosis: 'Hypertension (stage 1)', symptoms: ['headache'], meds: ['amlodipine'] },
  { diagnosis: 'Allergic rhinitis', symptoms: ['sneezing', 'itchy eyes'], meds: ['cetirizine'] },
  {
    diagnosis: 'Iron-deficiency anaemia',
    symptoms: ['fatigue', 'pallor'],
    meds: ['ferrous sulfate'],
  },
  { diagnosis: 'Type 2 diabetes - newly detected', symptoms: ['polyuria'], meds: ['metformin'] },
];
const NOTES_SNIPPET =
  'General condition stable. Advised hydration and rest. Discussed medication schedule.';

function patientAt(i) {
  // FIRST[0-9] are male given names, FIRST[10-19] female, so name and gender agree.
  const g = i % 3 === 0 ? 'other' : i % 2 === 0 ? 'female' : 'male';
  const firstPool = g === 'male' ? FIRST.slice(0, 10) : g === 'female' ? FIRST.slice(10) : FIRST;
  const first = firstPool[i % firstPool.length];
  const last = LAST[i % LAST.length];
  const age = 25 + ((i * 7) % 45); // ages 25-69, spread deterministically
  const dob = new Date(new Date().getFullYear() - age, (i * 5) % 12, ((i * 9) % 27) + 1);
  return {
    // MRN assigned HERE (not by the pre-save hook) so the 30-doc bulk insert
    // never races: batch hooks all read the same count before any insert lands.
    mrn: `MC-${String(i + 1).padStart(5, '0')}`,
    fullName: `${first} ${last}`,
    phone: `9${String(800000000 + i * 1234567).slice(0, 9)}`, // always starts with 9 → 6-9 digits ok
    dob,
    gender: g,
    bloodGroup: ['A+', 'B+', 'O+', 'AB+'][i % 4],
    address: `Plot ${10 + i}, Nigdi, Pimpri-Chinchwad, Pune ${411000 + (i % 60)}`,
    allergies: i % 5 === 0 ? ['penicillin'] : i % 7 === 0 ? ['sulfonamides', 'latex'] : [],
  };
}

/**
 * @param {object} opts { uri?, drop=true } — URI comes from MONGO_URI by default
 */
async function runSeed(opts = {}) {
  const uri = opts.uri || process.env.MONGO_URI;
  if (!mongoose.connection.readyState) {
    await mongoose.connect(uri, opts.memory ? {} : { serverSelectionTimeoutMS: 10000 });
    opts.standalone = opts.standalone ?? true;
  }

  // Wipe demo collections (dummy data project — nothing real is lost).
  await Promise.all([
    User.deleteMany({}),
    Patient.deleteMany({}),
    Visit.deleteMany({}),
    AuditLog.deleteMany({}),
    Appointment.deleteMany({}),
    Prescription.deleteMany({}),
    QueueToken.deleteMany({}),
  ]);

  const users = await User.create([
    {
      name: 'Anjali Deshmukh',
      email: 'doctor@clinic.test',
      password: 'Doctor@123',
      role: 'doctor',
      specialty: 'Cardiology',
      phone: '9822099881',
    },
    {
      name: 'Rohan Jadhav',
      email: 'doctor2@clinic.test',
      password: 'Doctor@123',
      role: 'doctor',
      specialty: 'Paediatrics',
      phone: '9822099882',
    },
    {
      name: 'Sneha Patil',
      email: 'staff@clinic.test',
      password: 'Staff@123',
      role: 'staff',
      phone: '9822099883',
    },
    { name: 'System Admin', email: 'admin@clinic.test', password: 'Admin@123', role: 'admin' },
  ]);
  const [doc1, doc2] = users.filter(u => u.role === 'doctor');

  // ---- patients ----
  const patientDocs = await Patient.create(
    Array.from({ length: 30 }, (_, i) => ({
      ...patientAt(i),
      primaryDoctorId: i % 2 ? doc1._id : doc2._id,
      createdBy: users[3]._id,
    }))
  );

  // ---- visits (deterministic spread over the last ~60 days) ----
  const visitsMade = [];
  for (const [i, patient] of patientDocs.entries()) {
    const nVisits = 1 + (i % 3); // 1-3 visits
    for (let k = 0; k < nVisits; k++) {
      // Spread visits from today back to ~30 days so a fresh seed shows both
      // visits today and a realistic handful of overdue follow-ups.
      const daysAgo = (i % 7) * 5 + k * 20;
      const btn = DIAGNOSES[(i + k) % DIAGNOSES.length];
      // Clinic hours 09:00-16:00 so the peak-hours chart has a real shape.
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() - daysAgo);
      visitDate.setHours(9 + ((i + k) % 8), (i * 13) % 60, 0, 0);
      if (visitDate > new Date()) visitDate.setTime(Date.now() - (k + 1) * 20 * 60 * 1000);
      const v = await Visit.create({
        patientId: patient._id,
        doctorId: patient.primaryDoctorId,
        visitDate,
        diagnosis: btn.diagnosis,
        symptoms: btn.symptoms,
        notes: NOTES_SNIPPET,
        vitals: {
          temperatureC: 36.5 + 0.5 * (k + 1) > 37.5 ? 37.1 : 36.8,
          bloodPressure: `${112 + ((i * 3) % 20)}/${74 + (i % 12)}`,
          heartRate: 70 + (i % 25),
        },
        createdBy: patient.primaryDoctorId,
      });
      v.familyId = v._id;
      await v.save();
      visitsMade.push(v);
    }
  }

  // ---- revision history for the demo (v2 for 6 visits, v3 for 2) ----
  async function makeNextVersion(from, patch, reason) {
    const maxNumber = Math.max(
      ...visitsMade
        .filter(x => String(x.familyId) === String(from.familyId))
        .map(x => x.versionNumber)
    );
    const next = await Visit.create({
      ...from.toObject(),
      ...patch,
      _id: undefined,
      versionNumber: maxNumber + 1,
      parentVisitId: from._id,
      changeReason: reason,
      isCurrent: true,
      createdAt: undefined,
      updatedAt: undefined,
    });
    next.familyId = from.familyId;
    await next.save();
    from.isCurrent = false;
    await from.save();
    visitsMade.push(next);
    return next;
  }

  for (let i = 0; i < 6; i++) {
    const base = visitsMade[i * 3]; // spread across patients
    await makeNextVersion(
      base,
      { diagnosis: `${base.diagnosis} (revised after lab report)` },
      'Revised after lab report'
    );
  }
  for (let i = 0; i < 2; i++) {
    const revised = visitsMade.filter(v => v.versionNumber === 2)[i];
    await makeNextVersion(
      revised,
      { notes: 'Patient responding well; continue current course, review in 2 weeks.' },
      'Reassured after follow-up'
    );
  }

  // ---- appointments: today + the next few days (dashboard date strip) ----
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const appointmentDocs = [];
  for (let i = 0; i < 18; i++) {
    const dayOffset = i % 6; // spread across today .. +5 days
    const at = new Date(today);
    at.setDate(at.getDate() + dayOffset);
    at.setHours(9 + (i % 8), i % 2 ? 30 : 0, 0, 0);
    appointmentDocs.push({
      patientId: patientDocs[i]._id,
      doctorId: patientDocs[i].primaryDoctorId,
      scheduledAt: at,
      disease: ['Fever', 'Follow-up', 'Blood pressure check', 'Skin rash', 'Vaccination'][i % 5],
      status: 'scheduled',
      createdBy: users[2]._id,
    });
  }
  await Appointment.create(appointmentDocs);

  // ---- prescriptions on the current visit of a few patients (PDF + QR demo) ----
  // One prescription per patient (no duplicate cards) so the list reads cleanly.
  const rxVisits = [];
  const seenPatient = new Set();
  for (const v of visitsMade) {
    const key = String(v.patientId);
    if (!v.isCurrent || seenPatient.has(key)) continue;
    seenPatient.add(key);
    rxVisits.push(v);
    if (rxVisits.length === 5) break;
  }
  const prescriptionDocs = await Prescription.create(
    rxVisits.map((v, i) => ({
      visitId: v._id,
      patientId: v.patientId,
      doctorId: v.doctorId,
      medicines: [
        { name: 'Paracetamol', dosage: '500 mg', frequency: '1-0-1', durationDays: 3 },
        {
          name: i % 2 ? 'Cetirizine' : 'Amoxicillin',
          dosage: i % 2 ? '10 mg' : '250 mg',
          frequency: '0-0-1',
          durationDays: 5,
        },
      ],
      advice: 'Plenty of fluids, light meals and rest. Return if fever crosses 102°F.',
    }))
  );

  // ---- today's waiting-room queue (Live Queue demo) ----
  const today0 = new Date();
  const pad2 = n => String(n).padStart(2, '0');
  const todayKey = `${today0.getFullYear()}-${pad2(today0.getMonth() + 1)}-${pad2(today0.getDate())}`;
  const queueStatuses = ['done', 'done', 'serving', 'waiting', 'waiting', 'waiting'];
  await QueueToken.create(
    queueStatuses.map((status, i) => ({
      dayKey: todayKey,
      tokenNumber: i + 1,
      patientId: patientDocs[i]._id,
      doctorId: patientDocs[i].primaryDoctorId,
      status,
      note: i === 2 ? 'Follow-up after lab report' : undefined,
      calledAt: status === 'done' || status === 'serving' ? new Date() : undefined,
      completedAt: status === 'done' ? new Date() : undefined,
      createdBy: users[2]._id,
    }))
  );

  const summary = {
    users: users.length,
    patients: patientDocs.length,
    visits: visitsMade.length,
    appointments: appointmentDocs.length,
    prescriptions: prescriptionDocs.length,
    queueTokens: queueStatuses.length,
  };
  console.log('Seed complete:', JSON.stringify(summary));

  if (opts.standalone) await mongoose.disconnect();
  return summary;
}

// ---- CLI entry: `node seed/seed.js` ----
if (require.main === module) {
  runSeed()
    .then(summary => {
      console.log('\nDemo logins (password shown once, seeded in plain by you, stored hashed):');
      console.log('  doctor : doctor@clinic.test  / Doctor@123');
      console.log('  staff  : staff@clinic.test   / Staff@123');
      console.log('  admin  : admin@clinic.test   / Admin@123');
      console.log(summary);
    })
    .catch(err => {
      console.error('Seed failed:', err.message);
      process.exit(1);
    });
}

module.exports = { runSeed };
