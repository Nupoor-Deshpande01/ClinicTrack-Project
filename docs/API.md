# ClinicTrack API

RESTful API for ClinicTrack (Express + MongoDB). Base URL in development:
`http://localhost:5000/api`.

- [Conventions](#conventions)
- [Auth](#auth)
- [Patients](#patients)
- [Visits (versioned)](#visits-versioned)
- [Prescriptions](#prescriptions)
- [Appointments](#appointments)
- [Live queue](#live-queue)
- [Audit log](#audit-log)
- [Analytics](#analytics)
- [Users](#users)
- [Export](#export)
- [Health](#health)
- [Socket.IO events](#socketio-events)
- [Error catalogue](#error-catalogue)

## Conventions

| Item            | Rule                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------- |
| Auth            | `Authorization: Bearer <JWT>` on every route except login and QR verify                      |
| Content type    | `application/json` for request bodies (PDF/CSV responses are binary/streams)                 |
| Success shape   | `{ success: true, message?: string, data: …, meta?: { … } }`                                 |
| Error shape     | `{ success: false, message: string, errors?: [{ field, message }] }`                         |
| Validation      | `express-validator` on the server, independent of the React/Yup rules                        |
| Pagination      | `?page=1&limit=10` → `meta: { page, limit, total, pages }`                                   |
| Rate limits     | 500 requests / 15 min per IP; login is limited to 20 / 15 min                                |
| Roles           | `doctor`, `staff` (reception), `admin`                                                       |
| Clinical data   | Visits, notes, prescriptions and the audit trail are doctor/admin only; reception gets `403` |
| Password hashes | Never selected (`select: false`) and never serialised                                        |

**Role matrix**

| Resource                          |    doctor    |    staff     | admin |
| --------------------------------- | :----------: | :----------: | :---: |
| Login / me                        |      ✓       |      ✓       |   ✓   |
| Patients list/read (demographics) |      ✓       |      ✓       |   ✓   |
| Patient create                    |      ✓       |      ✓       |   ✓   |
| Patient update / allergies        |      ✓       |      ✗       |   ✓   |
| Visits (all)                      |      ✓       |      ✗       |   ✓   |
| Prescriptions                     |      ✓       |      ✗       |   ✓   |
| Appointments                      |      ✓       |      ✓       |   ✓   |
| Queue                             |      ✓       |      ✓       |   ✓   |
| Audit log                         |      ✓       |      ✗       |   ✓   |
| Analytics                         |      ✓       |      ✗       |   ✓   |
| Users                             | doctors only | doctors only |  all  |
| Export                            |      ✗       |      ✗       |   ✓   |

## Auth

### POST `/auth/login`

Public. Rate limited to 20 attempts per 15 minutes.

```json
{ "email": "doctor@clinic.test", "password": "Doctor@123" }
```

`200`

```json
{
  "success": true,
  "message": "Welcome back, Anjali Deshmukh!",
  "token": "eyJhbGciOi…",
  "user": { "id": "…", "name": "Anjali Deshmukh", "role": "doctor", "specialty": "Cardiology" }
}
```

`401` invalid credentials · `422` malformed email or password shorter than 8 characters
(`errors: [{ "field": "email", "message": "A valid email is required" }]`).
Failed attempts emit a `LOGIN_FAILED` audit entry.

### GET `/auth/me`

Returns the logged-in account, re-read from the database (`200`, `{ success, user }`).
Used by the React app on boot to validate the stored token.

## Patients

### GET `/patients?search=&gender=&page=&limit=`

Any role. `search` matches name, MRN or phone (case-insensitive regex); `gender` is
`male|female|other`; `limit` is capped at 50.

```json
{
  "success": true,
  "message": "10 patient(s) found",
  "data": [
    {
      "id": "…",
      "_id": "…",
      "mrn": "MC-00001",
      "fullName": "Aarav Deshmukh",
      "phone": "9800000000",
      "dob": "1994-02-05T00:00:00.000Z",
      "gender": "male",
      "bloodGroup": "A+",
      "address": "Plot 10, Nigdi…",
      "allergies": ["penicillin"],
      "age": 32
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 30, "pages": 3 }
}
```

Reception (`staff`) receives the same rows **without `allergies`** — clinical fields are
dropped server-side (`toPatientJSON({ includeClinical })`).

### GET `/patients/:id`

Any role. Same single-patient shape (`data`), clinical fields trimmed for staff.

### POST `/patients`

`doctor | staff | admin`. Server-side rules (independent of the browser):

| Field        | Rule                                            |
| ------------ | ----------------------------------------------- |
| `fullName`   | letters, spaces, dots, hyphens; 2–60 characters |
| `phone`      | Indian mobile: exactly 10 digits starting 6–9   |
| `dob`        | ISO date, strictly in the past                  |
| `gender`     | `male` / `female` / `other`                     |
| `allergies`  | optional array of strings, each ≤ 60 characters |
| `bloodGroup` | optional enum                                   |

`201` — the response carries a **duplicate warning** when another patient shares the phone:

```json
{
  "success": true,
  "message": "Patient saved — note: same mobile number already belongs to patient MC-00028 (Nikhil Bhosale).",
  "data": { "id": "…", "mrn": "MC-00031", "fullName": "…" },
  "warnings": [
    {
      "field": "phone",
      "message": "Duplicate mobile number shared with MC-00028 · Nikhil Bhosale."
    }
  ]
}
```

A patient is still created (siblings can share a phone); the admin can decide.
Errors: `422` with per-field `errors`; the MRN is assigned server-side (`MC-00001`).

### PUT `/patients/:id`

`doctor | admin`. Same field rules. Reception may not edit `allergies` (`403`);
admin/doctor edits are audited as `PATIENT_UPDATED` with the changed field names.

## Visits (versioned)

A visit is **never updated in place**. `PUT` inserts a new document with
`versionNumber + 1`, `parentVisitId`, `changeReason` and `isCurrent: true`, then flips the
previous version's `isCurrent` to `false`. Rollback does the same, copying an older
version forward. This is what makes the timeline and diff trustworthy.

### POST `/patients/:id/visits`

`doctor | admin`. Creates version 1.

```json
{
  "visitDate": "2026-10-30",
  "diagnosis": "Acute viral fever",
  "symptoms": ["fever", "body ache"],
  "notes": "Stable. Advised hydration.",
  "vitals": { "temperatureC": 38.1, "bloodPressure": "118/76", "heartRate": 92 }
}
```

`201` → `data` = the visit (`id`, `versionNumber: 1`, `familyId`, `isCurrent: true`, `patient`).
Validation: `visitDate` ISO and not in the future, `diagnosis` 2–200 chars,
`bloodPressure` like `120/80`, `temperatureC` 30–45, `heartRate` 25–250.

### GET `/patients/:id/visits`

`doctor | admin`. Current versions only, newest first, each with `versionCount`.

### PUT `/visits/:id`

`doctor | admin`. Body: any of `visitDate`, `diagnosis`, `symptoms`, `notes`, `vitals`,
plus **required** `changeReason` (4–300 characters).

```json
{
  "diagnosis": "Acute viral fever (revised after lab report)",
  "changeReason": "Lab report received"
}
```

`201` `{ message: "New version v2 stored — history of v1 preserved.", data: { … } }`.
`409` when the id is not the current version; `400` when no editable field was sent;
`422` when `changeReason` is missing.

### GET `/visits/:id/versions`

`doctor | admin`. Whole family, oldest first, plus `currentVersionId`:

```json
{
  "success": true,
  "message": "3 version(s) for visit family …",
  "currentVersionId": "…",
  "data": [ { "versionNumber": 1, "isCurrent": false, … }, … ]
}
```

### GET `/visits/:a/diff/:b`

`doctor | admin`. Field-by-field comparison for the side-by-side viewer:

```json
{
  "success": true,
  "message": "2 field(s) differ.",
  "data": {
    "a": { … },
    "b": { … },
    "diff": [
      { "field": "diagnosis", "label": "Diagnosis", "a": "Acute viral fever", "b": "… (revised)", "changed": true },
      { "field": "visitDate", "label": "Visit date", "a": "2026-10-30", "b": "2026-10-30", "changed": false }
    ]
  }
}
```

Compared fields: visit date, diagnosis, symptoms, clinical notes, temperature, blood
pressure, heart rate. `400` if the two visits belong to different patients.

### POST `/visits/:id/rollback`

`doctor | admin`. Body `{ "targetVisitId": "…" }` — a **non-current** version of the same
family. Creates a new version that copies it (`rollbackOf` records the source), so the
timeline keeps every state that ever existed. `201`; `409` when `:id` is not current;
`400` for a foreign family or an already-current target.

## Prescriptions

### POST `/visits/:id/prescription`

`doctor | admin`, current visit version only (`409` otherwise).

```json
{
  "medicines": [
    { "name": "Paracetamol", "dosage": "500 mg", "frequency": "1-0-1", "durationDays": 3 },
    { "name": "Cetirizine", "dosage": "10 mg", "frequency": "0-0-1", "durationDays": 5 }
  ],
  "advice": "Plenty of fluids and rest."
}
```

`201` → the prescription including its 32-character `qrToken`.
Rules: at least one medicine; `dosage` must match `^\d+(\.\d+)?\s?(mg|ml|g|mcg|IU)$/i`
(so `500 mg` passes, `one big pill` → `422`); `durationDays` 1–180; `advice` ≤ 500 chars.

### GET `/visits/:id/prescriptions`

`doctor | admin`. Prescriptions written for that visit version, newest first.

### GET `/prescriptions?limit=`

`doctor | admin`. Recent prescriptions with `patient { fullName, mrn }` and
`doctor { name }` — powers the Prescriptions screen.

### GET `/prescriptions/:id/pdf`

`doctor | admin`. Streams an A5 PDF (`Content-Type: application/pdf`) with the clinic
letterhead, patient/visit block, medicine table, advice and a QR code that points at
`CLIENT_URL/verify/:qrToken`. The client fetches it as a blob because the request needs
the JWT.

### GET `/prescriptions/verify/:qrToken`

**Public** — no token required. This is what the QR code resolves to.

```json
{
  "success": true,
  "message": "Prescription verified.",
  "data": {
    "valid": true,
    "clinic": "CityCare Clinic",
    "issuedAt": "2026-10-30T08:31:39.000Z",
    "patient": { "fullName": "Ishita Jadhav", "mrn": "MC-00005" },
    "doctor": { "name": "Rohan Jadhav", "specialty": "Paediatrics" },
    "medicines": [
      { "name": "Paracetamol", "dosage": "500 mg", "frequency": "1-0-1", "durationDays": 3 }
    ],
    "advice": "Plenty of fluids…"
  }
}
```

`404` for an unknown token (the React page renders its "Not verified" state).

## Appointments

### GET `/appointments?date=YYYY-MM-DD`

Any role; defaults to today. Returns `data[]` with `patient`, `doctor`, `time`
(`09:30 am`), `disease`, `status` and `meta: { date, count }`.

### POST `/appointments`

`doctor | staff | admin`. Body `{ patientId, doctorId, scheduledAt (ISO), disease? }`.
`scheduledAt` may be at most one hour in the past. `201` → `{ data: { id } }`.

### DELETE `/appointments/:id`

`doctor | staff | admin`. `200`; audited as `APPOINTMENT_DELETED`.

## Live queue

Tokens are numbered per local day. Every write returns the whole day's queue and
broadcasts it over Socket.IO.

Queue snapshot shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "…",
      "tokenNumber": 4,
      "status": "waiting",
      "note": "Follow-up after lab report",
      "calledAt": null,
      "completedAt": null,
      "patient": { "id": "…", "fullName": "Siddharth Patil", "mrn": "MC-00004" },
      "doctor": { "id": "…", "name": "Anjali Deshmukh" }
    }
  ],
  "stats": { "waiting": 3, "serving": 1, "done": 2, "active": 4 }
}
```

### GET `/queue`

Any role. Today's tokens (oldest first) plus `stats`.

### POST `/queue`

Any role. Body `{ patientId, doctorId?, note? }`. `201` → next token number
(`Token 7 issued.`) and the refreshed snapshot. Duplicate tokens per day are impossible
(unique `{ dayKey, tokenNumber }` index).

### PATCH `/queue/:id`

Any role. Body `{ "status": "serving" }` — one of `waiting`, `serving`, `done`, `skipped`.
`serving` stamps `calledAt`, `done`/`skipped` stamp `completedAt`. `422` for any other
value.

## Audit log

### GET `/audit?page=&limit=&action=&entity=`

`doctor | admin`. Newest first.

```json
{
  "success": true,
  "data": [
    {
      "id": "…",
      "at": "2026-10-30T08:31:39.000Z",
      "actorName": "Anjali Deshmukh",
      "actorRole": "doctor",
      "action": "VISIT_VERSION_CREATED",
      "entity": "Visit",
      "entityId": "…",
      "details": { "patient": "MC-00003", "fromVersion": 1, "toVersion": 2 },
      "prevHash": "bc27…",
      "hash": "9f36…"
    }
  ],
  "meta": { "page": 1, "limit": 25, "total": 42, "pages": 2 }
}
```

Actions emitted today: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `PATIENT_CREATED`,
`PATIENT_UPDATED`, `VISIT_CREATED`, `VISIT_VERSION_CREATED`, `VISIT_ROLLBACK`,
`PRESCRIPTION_CREATED`, `APPOINTMENT_CREATED`, `APPOINTMENT_DELETED`, `QUEUE_TOKEN_ADDED`,
`QUEUE_TOKEN_UPDATED`, `USER_CREATED`, `DAILY_MAINTENANCE`.

### GET `/audit/verify`

`doctor | admin`. Recomputes `SHA-256(prevHash + canonical JSON)` for every entry in
insertion order.

Intact:

```json
{
  "success": true,
  "message": "All 42 entries verified.",
  "data": { "valid": true, "checked": 42, "total": 42 }
}
```

Tampered (`200`, so the UI can render it):

```json
{
  "success": true,
  "message": "Chain broken at entry 8 (VISIT_ROLLBACK).",
  "data": {
    "valid": false,
    "checked": 8,
    "total": 42,
    "firstBroken": {
      "position": 8,
      "action": "VISIT_ROLLBACK",
      "expectedHash": "…",
      "storedHash": "…",
      "expectedPrevHash": "…",
      "storedPrevHash": "…"
    }
  }
}
```

## Analytics

### GET `/analytics/summary?months=6`

`doctor | admin`. One aggregation-backed payload for the dashboard and reports screen:

```json
{
  "success": true,
  "data": {
    "stats": {
      "totalPatients": 30,
      "visitsToday": 5,
      "pendingFollowUps": 8,
      "activeQueue": 4,
      "appointmentsToday": 3
    },
    "arrivalSeries": [{ "month": "May", "in": 0, "out": 6 }],
    "doctors": [{ "id": "…", "name": "Anjali Deshmukh", "specialty": "Cardiology" }],
    "visitTrend": [{ "date": "2026-10-17", "label": "17 Oct", "count": 0 }],
    "topDiagnoses": [{ "diagnosis": "Acute viral fever", "count": 14 }],
    "newVsReturning": [
      { "name": "New patients", "value": 10 },
      { "name": "Returning patients", "value": 20 }
    ],
    "peakHours": [{ "hour": "09:00", "count": 6 }]
  }
}
```

`pendingFollowUps` counts patients whose newest current visit is older than 21 days;
`peakHours` buckets visits by the server's local timezone.

## Users

### GET `/users?role=doctor`

Any role. Non-admins see **doctors only** and never receive emails; admins see every
account (`403` if a non-admin asks for `staff` or `admin`).

### POST `/users`

`admin`. `{ name, email, password (≥ 8), role, specialty?, phone? }` → `201` with
`toSafeJSON()` (no hash). `409` when the email already exists.

## Export

### GET `/export/backup`

`admin`. Writes a JSON snapshot (patients, visits, prescriptions, appointments, queue,
audit trail, users without password hashes) to `server/backups/`, then streams it with a
`Content-Disposition` attachment and deletes the file. `fs` + `stream.pipeline` on the
server, no in-memory buffering.

### GET `/export/patients.csv`

`admin`. Same idea, CSV with a header row and one row per patient (Excel-safe quoting).

## Health

### GET `/health`

Public. `{ success, db, uptimeSeconds, plus: { nodeVersion, hostname, osUptimeSeconds, totalMemoryMB, freeMemoryMB, load1m } }`
— powered by Node's `os` module.

## Socket.IO events

Connect to the API origin with the JWT in the handshake:

```js
io('http://localhost:5000', { auth: { token } });
```

| Event          | Direction     | Payload                                     |
| -------------- | ------------- | ------------------------------------------- |
| `queue:update` | server→client | the full queue snapshot (`{ data, stats }`) |

Unauthenticated sockets are rejected. Clients refetch `GET /queue` on mount and treat
`queue:update` as authoritative afterwards.

## Error catalogue

| Status | When                                                                         |
| ------ | ---------------------------------------------------------------------------- |
| `400`  | Semantically impossible request (diff across patients, no fields to update)  |
| `401`  | Missing/expired/invalid JWT, wrong credentials                               |
| `403`  | Role not allowed (reception reading visits, non-admin export)                |
| `404`  | Unknown id, route or QR token                                                |
| `409`  | Edit/rollback on a non-current version, duplicate email                      |
| `422`  | `express-validator` failures; body carries `errors[]` with `field`+`message` |
| `429`  | Rate limit exceeded                                                          |
| `500`  | Unexpected server error (central handler, stack only in server logs)         |
