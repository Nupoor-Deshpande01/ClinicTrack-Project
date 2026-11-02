# Controllers Implementation in ClinicTrack

## 1. Executive Overview

In **ClinicTrack**, **Controllers** (`server/controllers/`) encapsulate the application's core business logic, database queries, and response formatting. In the Model-View-Controller (MVC) architectural pattern, controllers act as the coordinators between Mongoose models (database) and Express routes (HTTP interface).

### Why separate Controllers from Routes?
- **Single Responsibility Principle (SRP):** Route files (`server/routes/`) handle only path routing, role authorization, and validation rules. Controllers handle only business data manipulation.
- **Maintainability & Testability:** Controller functions can be imported and unit-tested in isolation by mocking the `req` and `res` objects.
- **Data Protection & Sanitization:** Controllers filter confidential medical fields (e.g., hiding allergies and clinical notes from reception staff) before returning JSON payloads.

---

## 2. Directory Structure & Controller Inventory

```
server/controllers/
├── auth.controller.js         # User login, password hashing verification, JWT generation
├── patient.controller.js      # Patient demographic CRUD, MRN generation, staff masking
├── visit.controller.js        # Git-style versioned consultations, diffing, rollback
├── prescription.controller.js # Medicine validation, allergy checks, PDFKit streaming
├── queue.controller.js        # Daily token sequence, state transitions, Socket.IO broadcast
├── analytics.controller.js    # MongoDB aggregation pipelines (trends, peak hours)
├── audit.controller.js        # SHA-256 audit log retrieval
├── appointment.controller.js  # Patient appointment scheduling & status updates
├── user.controller.js         # Staff and clinician account administration
└── export.controller.js       # Streaming CSV/JSON clinical database exports
```

---

## 3. Deep-Dive Code Walkthroughs

### A. Git-Style Consultation Versioning (`visit.controller.js`)
Medical records must never be overwritten in place. The `visit.controller.js` implements append-only commits:

```javascript
// server/controllers/visit.controller.js (Lines 116-150)
async function updateVisit(req, res) {
  const current = await Visit.findById(req.params.id);
  if (!current) throw new HttpError(404, 'Visit not found.');
  
  // Rule 1: Only the latest version can be amended
  if (!current.isCurrent) {
    throw new HttpError(409, 'Only the CURRENT version can be edited.');
  }

  // Rule 2: Clinician must state clinical rationale for edit
  if (!req.body.changeReason || !String(req.body.changeReason).trim()) {
    throw new HttpError(422, 'changeReason is required when editing a visit.');
  }

  // Step 1: Mark previous version as no longer current
  current.isCurrent = false;
  await current.save();

  // Step 2: Insert a NEW document with incremented versionNumber
  const nextVersion = cloneVersion(current, req.body, req.user.id);
  nextVersion.versionNumber = current.versionNumber + 1;
  nextVersion.parentVisitId = current._id;
  nextVersion.changeReason = req.body.changeReason;
  nextVersion.isCurrent = true;
  await nextVersion.save();

  // Step 3: Emit tamper-evident audit event
  emitAudit({
    actorId: req.user.id,
    action: 'VISIT_VERSION_CREATED',
    entity: 'Visit',
    entityId: nextVersion._id.toString(),
    details: { version: nextVersion.versionNumber, reason: nextVersion.changeReason }
  });

  res.status(201).json({
    success: true,
    message: `New version (v${nextVersion.versionNumber}) recorded.`,
    data: visitJSON(nextVersion)
  });
}
```

### B. Patient Data Masking & Auto-MRN (`patient.controller.js`)
Reception staff must never receive clinical details (like allergies or clinical notes). The controller enforces data masking:

```javascript
// server/controllers/patient.controller.js
async function getPatient(req, res) {
  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new HttpError(404, 'Patient not found.');

  // Mask clinical data if requester is reception staff
  const isStaff = req.user.role === 'staff';
  const json = patient.toPatientJSON({ includeClinical: !isStaff });

  res.json({ success: true, data: json });
}
```

### C. Live Queue State Machine (`queue.controller.js`)
Manages daily waiting room queues with atomic token transitions and real-time WebSocket dispatch:

```javascript
// server/controllers/queue.controller.js
async function updateTokenStatus(req, res) {
  const token = await QueueToken.findById(req.params.id);
  if (!token) throw new HttpError(404, 'Token not found.');

  const { status } = req.body; // 'waiting' -> 'serving' -> 'done' or 'skipped'
  token.status = status;
  if (status === 'serving') token.calledAt = new Date();
  if (status === 'done') token.completedAt = new Date();
  await token.save();

  // Broadcast full snapshot to all connected screens (reception & TV display)
  const fullQueue = await snapshot();
  emitQueue('queue:updated', fullQueue);

  res.json({ success: true, message: `Token #${token.tokenNumber} is now ${status}.` });
}
```

### D. Complex MongoDB Aggregations (`analytics.controller.js`)
Instead of pulling thousands of records into Node.js and calculating averages in JavaScript, the controller executes native multi-stage MongoDB aggregation pipelines:

```javascript
// server/controllers/analytics.controller.js (Lines 34-40)
// Calculate pending follow-ups using native aggregation
const followUpCutoff = new Date(Date.now() - 21 * 86400000);
const lastVisits = await Visit.aggregate([
  { $match: { isCurrent: true } },
  { $group: { _id: '$patientId', lastVisit: { $max: '$visitDate' } } },
  { $match: { lastVisit: { $lt: followUpCutoff } } },
  { $count: 'count' }
]);
```

### E. Dynamic PDFKit Streaming (`prescription.controller.js`)
Generates digital prescriptions on the fly and streams binary data without touching disk storage:

```javascript
// server/controllers/prescription.controller.js
async function downloadPDF(req, res) {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patientId')
    .populate('doctorId');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=prescription-${prescription._id}.pdf`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res); // Pipes stream directly into HTTP network socket

  // Embed clinic header, patient details, medicine table, and dynamic QR code
  buildPrescriptionDocument(doc, prescription);
  doc.end();
}
```

---

## 4. Examiner Viva & Defense Guide

### Q1: How does `visit.controller.js` implement Non-Destructive Rollbacks?
**Answer:** In `rollbackVisit(req, res)`, when a doctor selects version 1 to restore from version 3, the controller **does not delete** version 2 or 3. Instead, it copies version 1's clinical contents into a brand-new **version 4 document** marked with `rollbackOf: v1._id` and sets `isCurrent: true`. This ensures an append-only, tamper-evident audit history.

### Q2: Why calculate analytics in MongoDB Aggregations rather than JavaScript loops?
**Answer:** Aggregations run directly inside the database engine in optimized C++. Pulling 10,000 documents into Node.js to compute counts or groupings consumes excessive RAM, causes garbage collection latency, and saturates network bandwidth between Node and MongoDB.

### Q3: How do Controllers interact with the Cryptographic Audit Service?
**Answer:** Controllers invoke `emitAudit({ actorId, action, entity, entityId, details })` from `server/services/audit.service.js`. Because `emitAudit` uses an internal Node.js `EventEmitter`, the audit hash calculation and database write execute asynchronously in the background without adding latency to the client's HTTP response.
