/**
 * smoke.js — end-to-end verification of the Phase 2 backend, no browser needed.
 *
 * It boots a throwaway in-memory MongoDB (mongodb-memory-server, dev dep),
 * seeds it, starts the real Express app on an ephemeral port and exercises
 * the API with fetch. Exit code 0 = everything works.
 *
 * Run:  npm test    (from server/)
 */
process.env.JWT_SECRET = 'smoke-test-secret';
const { MongoMemoryServer } = require('mongodb-memory-server');

const PASS = [];
const FAIL = [];

function check(name, condition, detail = '') {
  if (condition) {
    PASS.push(name);
  } else {
    FAIL.push({ name, detail });
  }
}

async function api(port, path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON response body → keep empty */
  }
  return { status: res.status, json };
}

async function main() {
  const memory = await MongoMemoryServer.create();
  const connectDB = require('../config/db').connectDB;
  const { runSeed } = require('../seed/seed');
  const createApp = require('../app');
  const mongoose = require('mongoose');

  await connectDB(memory.getUri('clinictrack-smoke'));
  await runSeed({ memory: true });

  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;

  try {
    /* ---------- 1. health (os module) ---------- */
    const health = await api(port, '/api/health');
    check(
      'health: reachable',
      health.status === 200 && health.json.uptimeSeconds >= 0,
      JSON.stringify(health.json)
    );

    /* ---------- 2. auth ---------- */
    const badLogin = await api(port, '/api/auth/login', {
      method: 'POST',
      body: { email: 'doctor@clinic.test', password: 'wrongpass' },
    });
    check('login: wrong password → 401', badLogin.status === 401, JSON.stringify(badLogin.json));

    const badPayload = await api(port, '/api/auth/login', {
      method: 'POST',
      body: { email: 'nope', password: '123' },
    });
    check(
      'login: invalid payload → 422 + field errors',
      badPayload.status === 422 && badPayload.json.errors?.some(e => e.field === 'email'),
      JSON.stringify(badPayload.json)
    );

    const docLogin = await api(port, '/api/auth/login', {
      method: 'POST',
      body: { email: 'doctor@clinic.test', password: 'Doctor@123' },
    });
    check(
      'login: doctor → token',
      docLogin.status === 200 && !!docLogin.json.token,
      JSON.stringify(docLogin.json)
    );
    const docTok = docLogin.json.token;
    check(
      'login: safe user (no password)',
      docLogin.json.user && docLogin.json.user.password === undefined
    );

    const staffLogin = await api(port, '/api/auth/login', {
      method: 'POST',
      body: { email: 'staff@clinic.test', password: 'Staff@123' },
    });
    const staffTok = staffLogin.json.token;
    const noTok = await api(port, '/api/patients');
    check('NO token → 401', noTok.status === 401);
    const me = await api(port, '/api/auth/me', { token: docTok });
    check('/auth/me role=doctor', me.status === 200 && me.json.user.role === 'doctor');

    /* ---------- 3. patients ---------- */
    const list0 = await api(port, '/api/patients', { token: docTok });
    check('patients: 30 seeded', list0.json.meta?.total === 30, `got ${list0.json.meta?.total}`);
    check(
      'patients: pagination meta',
      list0.json.meta?.pages === 3 && list0.json.meta?.limit === 10,
      JSON.stringify(list0.json.meta)
    );

    const search = await api(
      port,
      `/api/patients?search=${encodeURIComponent(list0.json.data[1].fullName.split(' ')[0])}`,
      { token: docTok }
    );
    check('patients: search narrows', search.json.meta.total < 30 && search.json.data.length >= 1);

    const badPatient = await api(port, '/api/patients', {
      method: 'POST',
      token: staffTok,
      body: { fullName: '123 Bad', phone: '12345', dob: '2030-01-01', gender: 'x' },
    });
    check(
      'patients: server validation → 422 with fields',
      badPatient.status === 422 &&
        ['fullName', 'phone', 'dob', 'gender'].every(f =>
          badPatient.json.errors.some(e => e.field === f)
        ),
      JSON.stringify(badPatient.json.errors)
    );

    const created = await api(port, '/api/patients', {
      method: 'POST',
      token: staffTok,
      body: {
        fullName: 'Ravi Kulkarni',
        phone: '9822347890',
        dob: '1991-03-14',
        gender: 'male',
        bloodGroup: 'O+',
        address: 'Nigdi, Pune',
      },
    });
    check(
      'patients: staff can register (201, MRN)',
      created.status === 201 && /^MC-\d{5}$/.test(created.json.data.mrn),
      JSON.stringify(created.json)
    );
    const createdId = created.json.data.id;
    const dup = await api(port, '/api/patients', {
      method: 'POST',
      token: docTok,
      body: { fullName: 'Ravi Kumar', phone: '9822347890', dob: '1990-05-02', gender: 'male' },
    });
    check(
      'patients: duplicate phone → warning',
      dup.status === 201 && dup.json.warnings?.length === 1,
      JSON.stringify(dup.json.warnings)
    );

    const staffView = await api(port, `/api/patients/${createdId}`, { token: staffTok });
    check(
      'role rule: staff sees NO allergies',
      staffView.json.data.allergies === undefined,
      JSON.stringify(Object.keys(staffView.json.data))
    );
    const docView = await api(port, `/api/patients/${createdId}`, { token: docTok });
    const seededAllergies = docView.json.data.allergies !== undefined;
    check('role rule: doctor sees allergies field', seededAllergies);

    const staffEditClin = await api(port, `/api/patients/${createdId}`, {
      method: 'PUT',
      token: staffTok,
      body: { allergies: ['aspirin'] },
    });
    check('role rule: staff cannot edit allergies → 403', staffEditClin.status === 403);

    /* ---------- 4. visits — the versioning core ---------- */
    const seedPatients = await api(port, '/api/patients?limit=1&page=1', { token: docTok });
    const pid = seedPatients.json.data[0].id;

    const staffVisitTry = await api(port, `/api/patients/${pid}/visits`, {
      method: 'POST',
      token: staffTok,
      body: {},
    });
    check('role rule: staff cannot create visits → 403', staffVisitTry.status === 403);

    const visitRuleBad = await api(port, `/api/patients/${pid}/visits`, {
      method: 'POST',
      token: docTok,
      body: { diagnosis: 'x', visitDate: '2099-01-01' },
    });
    check(
      'visits: future date + short diagnosis → 422',
      visitRuleBad.status === 422 && visitRuleBad.json.errors.some(e => e.field === 'visitDate'),
      JSON.stringify(visitRuleBad.json.errors)
    );

    const v1 = await api(port, `/api/patients/${pid}/visits`, {
      method: 'POST',
      token: docTok,
      body: {
        visitDate: new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10),
        diagnosis: 'Acute viral fever',
        symptoms: ['fever'],
        notes: 'Rest advised',
        vitals: { temperatureC: 38.2, bloodPressure: '110/70', heartRate: 88 },
      },
    });
    check(
      'visit v1 created (isCurrent, versionNumber 1)',
      v1.status === 201 &&
        v1.json.data.versionNumber === 1 &&
        v1.json.data.isCurrent &&
        v1.json.data.familyId === v1.json.data.id,
      JSON.stringify(v1.json.data)
    );
    const vid = v1.json.data.id;

    const v2NoReason = await api(port, `/api/visits/${vid}`, {
      method: 'PUT',
      token: docTok,
      body: { diagnosis: 'Dengue', notes: 'Platelets watched' },
    });
    check(
      'edit without changeReason → 422',
      v2NoReason.status === 422 && v2NoReason.json.errors.some(e => e.field === 'changeReason')
    );

    const v2 = await api(port, `/api/visits/${vid}`, {
      method: 'PUT',
      token: docTok,
      body: { diagnosis: 'Dengue', notes: 'Platelets watched', changeReason: 'Lab NS1 positive' },
    });
    check(
      'edit → v2 (v1 untouched, isCurrent flip)',
      v2.status === 201 &&
        v2.json.data.versionNumber === 2 &&
        v2.json.data.parentVisitId === vid &&
        v2.json.data.isCurrent,
      JSON.stringify(v2.json.data)
    );

    const versions = await api(port, `/api/visits/${vid}/versions`, { token: docTok });
    check(
      'timeline: 2 versions, v1 isCurrent=false',
      versions.json.data.length === 2 &&
        versions.json.data[0].isCurrent === false &&
        versions.json.data[1].isCurrent === true,
      JSON.stringify(versions.json.data.map(v => [v.versionNumber, v.isCurrent]))
    );

    const diff = await api(
      port,
      `/api/visits/${versions.json.data[0].id}/diff/${versions.json.data[1].id}`,
      { token: docTok }
    );
    const changedFields = diff.json.data.diff.filter(d => d.changed).map(d => d.field);
    check(
      'diff: diagnosis + notes differ, others equal',
      diff.status === 200 &&
        changedFields.includes('diagnosis') &&
        changedFields.includes('notes') &&
        !changedFields.includes('heartRate'),
      JSON.stringify(changedFields)
    );

    const oldV1 = versions.json.data[0].id;
    const rb = await api(port, `/api/visits/${versions.json.data[1].id}/rollback`, {
      method: 'POST',
      token: docTok,
      body: { targetVisitId: oldV1 },
    });
    check(
      'rollback → v3 copying v1',
      rb.status === 201 &&
        rb.json.data.versionNumber === 3 &&
        rb.json.data.diagnosis === 'Acute viral fever' &&
        rb.json.data.isCurrent,
      JSON.stringify(rb.json.data)
    );

    const rbAgain = await api(port, `/api/visits/${versions.json.data[1].id}/rollback`, {
      method: 'POST',
      token: docTok,
      body: { targetVisitId: oldV1 },
    });
    check('rollback only from current → 409', rbAgain.status === 409, `got ${rbAgain.status}`);

    const list1 = await api(port, `/api/patients/${pid}/visits`, { token: docTok });
    check(
      'patient visit list: current visit carry versionCount 3',
      list1.json.data.length === 1 && list1.json.data[0].versionCount === 3,
      JSON.stringify(list1.json.data.map(v => v.versionCount))
    );

    const staffListVisits = await api(port, `/api/patients/${pid}/visits`, { token: staffTok });
    check(
      'role rule: staff cannot READ visits → 403',
      staffListVisits.status === 403,
      `got ${staffListVisits.status}`
    );

    /* ---------- 5. audit chain (crypto) ---------- */
    await new Promise(r => setTimeout(r, 100)); // let queued audit writes finish
    const AuditLog = require('../models/auditLog.model');
    const { computeHash, auditPayload } = require('../services/audit.service');
    const entries = await AuditLog.find({}).sort({ createdAt: 1, _id: 1 });
    check(
      'audit: entries exist (login failure + writes)',
      entries.length >= 6,
      `got ${entries.length}`
    );

    let chainOK = true,
      broken = null,
      prev = 'GENESIS';
    for (const e of entries) {
      if (e.prevHash !== prev) {
        chainOK = false;
        broken = e || 'prevHash mismatch';
        break;
      }
      if (computeHash(prev, auditPayload(e)) !== e.hash) {
        chainOK = false;
        broken = e.action;
        break;
      }
      prev = e.hash;
    }
    check(
      'audit: SHA-256 chain verifies end-to-end',
      chainOK,
      `first broken: ${broken && broken.action ? broken.action : broken}`
    );

    // Negative test: editing ONE historical entry must break the chain.
    const tampered = entries[entries.length - 1];
    tampered.details = { ...tampered.details, tampered: true };
    await tampered.save();
    const recompute = computeHash(tampered.prevHash, auditPayload(tampered));
    check('audit: chain detects tampering', recompute !== tampered.hash);
    check(
      'audit: never stores plaintext or hash of password',
      entries.every(
        e => e.details === undefined || !JSON.stringify(e.details).includes('password')
      ),
      ''
    );

    /* ---------- 6. Phase 3 surface: analytics, appointments, users, prescriptions ---------- */
    const analytics = await api(port, '/api/analytics/summary?months=6', { token: docTok });
    const stats = analytics.json.data?.stats || {};
    check(
      'analytics: stat fields present',
      analytics.status === 200 &&
        stats.totalPatients >= 30 &&
        typeof stats.visitsToday === 'number' &&
        typeof stats.pendingFollowUps === 'number',
      JSON.stringify(stats)
    );
    check(
      'analytics: 6-month arrival series',
      analytics.json.data.arrivalSeries.length === 6 &&
        analytics.json.data.arrivalSeries.every(m => 'in' in m && 'out' in m)
    );
    check(
      'analytics: doctors listed for specialist panel',
      analytics.json.data.doctors.length === 2
    );

    const appts = await api(port, '/api/appointments', { token: staffTok });
    check(
      'appointments: today list populated',
      appts.status === 200 && appts.json.data.length >= 1 && appts.json.data[0].patient?.fullName,
      JSON.stringify(appts.json.meta)
    );

    const newAppt = await api(port, '/api/appointments', {
      method: 'POST',
      token: staffTok,
      body: {
        patientId: pid,
        doctorId: analytics.json.data.doctors[0].id,
        scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        disease: 'Fever',
      },
    });
    check('appointments: staff can book', newAppt.status === 201, JSON.stringify(newAppt.json));
    const delAppt = await api(port, `/api/appointments/${newAppt.json.data.id}`, {
      method: 'DELETE',
      token: staffTok,
    });
    check('appointments: delete works', delAppt.status === 200);

    const usersAdmin = await api(port, '/api/users', {
      token: (
        await api(port, '/api/auth/login', {
          method: 'POST',
          body: { email: 'admin@clinic.test', password: 'Admin@123' },
        })
      ).json.token,
    });
    check(
      'users: admin sees all 4 accounts',
      usersAdmin.status === 200 && usersAdmin.json.data.length === 4
    );
    const usersDoctor = await api(port, '/api/users', { token: docTok });
    check(
      'users: doctor sees only doctors',
      usersDoctor.status === 200 &&
        usersDoctor.json.data.every(u => u.role === 'doctor' && u.email === undefined)
    );

    const badRx = await api(port, `/api/visits/${rb.json.data.id}/prescription`, {
      method: 'POST',
      token: docTok,
      body: {
        medicines: [
          { name: 'Paracetamol', dosage: 'one big pill', frequency: '1-0-1', durationDays: 3 },
        ],
      },
    });
    check(
      'prescription: non-conforming dosage → 422',
      badRx.status === 422 && badRx.json.errors.some(e => e.field.includes('dosage')),
      JSON.stringify(badRx.json.errors)
    );

    const rx = await api(port, `/api/visits/${rb.json.data.id}/prescription`, {
      method: 'POST',
      token: docTok,
      body: {
        medicines: [{ name: 'Paracetamol', dosage: '500 mg', frequency: '1-0-1', durationDays: 3 }],
        advice: 'Rest and fluids',
      },
    });
    check(
      'prescription: doctor creates with QR token',
      rx.status === 201 && rx.json.data.qrToken?.length === 32,
      JSON.stringify(rx.json)
    );
    const rxList = await api(port, `/api/visits/${rb.json.data.id}/prescriptions`, {
      token: docTok,
    });
    check(
      'prescription: listed for the visit',
      rxList.status === 200 && rxList.json.data.length === 1
    );
    const rxStaff = await api(port, `/api/visits/${rb.json.data.id}/prescriptions`, {
      token: staffTok,
    });
    check('role rule: staff cannot read prescriptions → 403', rxStaff.status === 403);

    /* ---------- 7. JSON envelope + unknown route ---------- */
    const unknown = await api(port, '/api/nonsense', { token: docTok });
    check(
      'unknown route → 404 envelope',
      unknown.status === 404 &&
        unknown.json.success === false &&
        typeof unknown.json.message === 'string'
    );
    const badVisitParam = await api(port, '/api/visits/notanid/versions', { token: docTok });
    check(
      'bad Mongo id → 422 param validation',
      badVisitParam.status === 422,
      `got ${badVisitParam.status}`
    );
  } finally {
    server.close();
    await mongoose.disconnect();
    await memory.stop();
  }

  console.log(`\n=== SMOKE: ${PASS.length} passed, ${FAIL.length} failed ===`);
  PASS.forEach(p => console.log(`  PASS ${p}`));
  if (FAIL.length) {
    FAIL.forEach(f => console.log(`  FAIL ${f.name} — ${f.detail}`));
    process.exit(1);
  }
  console.log('All backend smoke checks passed.');
}

main().catch(err => {
  console.error('Smoke run failed:', err);
  process.exit(1);
});
