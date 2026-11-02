# Node.js Implementation in ClinicTrack

## 1. Executive Overview

In **ClinicTrack**, **Node.js (v18+ LTS)** serves as the high-performance runtime environment powering the entire server-side application located in the `server/` workspace.

### Why Node.js was chosen:
- **Unified Full-Stack Language:** Enables a single programming language (JavaScript / ES6+) across both client and server, allowing shared regex patterns, JSON serialization, and data validation concepts.
- **Asynchronous, Non-Blocking I/O:** The single-threaded JavaScript Event Loop paired with the multi-threaded `libuv` thread pool handles hundreds of concurrent patient queries, appointment bookings, and live queue updates without thread-starvation overhead.
- **Rich Core Standard Library:** ClinicTrack leverages Node.js core modules (`crypto`, `events`, `stream`, `http`, `os`, `path`) to implement security-critical and performance-critical operations without relying on fragile external packages.

---

## 2. Directory Structure & Core Module Map

```
server/
├── index.js                      # Core http server, Socket.IO binding, node-cron jobs
├── app.js                        # Express initialization, core os health check, core path resolution
├── package.json                  # Node engine >= 18, dependencies, workspaces
├── config/
│   └── db.js                     # MongoDB connection via Mongoose
├── services/
│   ├── audit.service.js          # Node crypto (SHA-256) & Node events (EventEmitter)
│   └── realtime.service.js       # WebSocket broadcasting attached to Node http server
├── controllers/
│   ├── prescription.controller.js # Node Streams & Buffers (pdfkit streaming)
│   └── export.controller.js      # Cursor-based CSV data streaming
└── seed/
    └── seed.js                   # Node fs & path for seed record generation
```

---

## 3. Deep-Dive Core Module Implementations

### A. Shared HTTP Server & WebSocket Attachment (`server/index.js`)
Instead of running separate ports for REST APIs and WebSockets, Node's built-in `http` module wraps Express and Socket.IO together:

```javascript
// server/index.js (Lines ~10-25)
const http = require('http');
const createApp = require('./app');
const { initRealtime } = require('./services/realtime.service');

const app = createApp();
const server = http.createServer(app); // Core Node HTTP server

// Attach Socket.IO to the exact same HTTP instance
initRealtime(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```
This architecture simplifies deployment on cloud hosts like Render and ensures CORS rules apply uniformly.

### B. Cryptographic SHA-256 Hash Chain (`server/services/audit.service.js`)
To ensure clinical records cannot be tampered with undetected, ClinicTrack utilizes Node's built-in `crypto` module to compute SHA-256 hashes:

```javascript
// server/services/audit.service.js (Lines 31-37)
const crypto = require('crypto');

function computeHash(prevHash, payload) {
  return crypto
    .createHash('sha256')
    .update(prevHash + JSON.stringify(payload))
    .digest('hex');
}
```
Every audit log stores the hash of its predecessor, creating a cryptographic chain:
$$\text{Hash}_i = \text{SHA-256}(\text{Hash}_{i-1} + \text{Payload}_i)$$

### C. Decoupled Asynchronous Events via `EventEmitter` (`server/services/audit.service.js`)
Audit logging should never block the main HTTP request/response cycle. ClinicTrack uses Node's `events` module:

```javascript
// server/services/audit.service.js (Lines 12-16, 87-93)
const events = require('events');
const auditBus = new events.EventEmitter();

auditBus.on('audit', enqueue); // Asynchronous sequential write queue

function emitAudit(entry) {
  auditBus.emit('audit', entry); // Fire-and-forget: does not block HTTP thread
}
```
When a doctor updates a consultation in `visit.controller.js`, `emitAudit(...)` is invoked. The controller sends the HTTP response immediately to the user while the event listener logs the audit record in the background.

### D. Memory-Efficient Binary Streaming (`server/controllers/prescription.controller.js`)
When generating downloadable prescription PDFs, holding binary PDFs in server RAM causes memory spikes under load. ClinicTrack uses **Node.js Writable Streams** via `pdfkit`:

```javascript
// server/controllers/prescription.controller.js
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `attachment; filename=prescription-${prescription._id}.pdf`);

const doc = new PDFDocument({ margin: 50 });
doc.pipe(res); // Pipes chunks directly to the client network socket as they are generated

doc.fontSize(18).text('CityCare Clinic - Prescription', { align: 'center' });
// ... draw medicines, doctor signature, QR code
doc.end(); // Closes stream; memory is garbage-collected immediately
```

### E. Operating System Health Telemetry (`server/app.js`)
The diagnostic `/api/health` endpoint exposes real-time OS metrics via Node's `os` module:

```javascript
// server/app.js (Lines 72-87)
const os = require('os');

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    uptimeSeconds: Math.round(process.uptime()),
    plus: {
      nodeVersion: process.version,
      hostname: os.hostname(),
      osUptimeSeconds: Math.round(os.uptime()),
      totalMemoryMB: Math.round(os.totalmem() / 1024 ** 2),
      freeMemoryMB: Math.round(os.freemem() / 1024 ** 2),
      load1m: os.loadavg()[0],
    },
  });
});
```

### F. Automated Scheduled Tasks (`node-cron`)
In `server/index.js`, background jobs run automatically without third-party external schedulers:
```javascript
// server/index.js
cron.schedule('0 0 * * *', async () => {
  // Midnight job: auto-archive yesterday's uncompleted queue tokens
  await QueueToken.updateMany(
    { dayKey: { $lt: todayKey() }, status: 'waiting' },
    { status: 'skipped', note: 'Auto-expired at midnight' }
  );
});
```

---

## 4. Examiner Viva & Defense Guide

### Q1: Is Node.js Single-Threaded or Multi-Threaded?
**Answer:** Node.js executes JavaScript on a **single thread** (the Event Loop). However, Node.js is internally **multi-threaded** through the `libuv` C++ library. `libuv` maintains a thread pool (default 4 threads) that executes heavy, blocking tasks (file system I/O, DNS lookups, compression, and cryptography) in background threads, notifying the Event Loop upon completion.

### Q2: Explain the Event Loop and its Phases.
**Answer:** The Event Loop orchestrates asynchronous non-blocking execution across distinct phases:
1. **Timers Phase:** Executes callbacks scheduled by `setTimeout()` and `setInterval()`.
2. **Pending Callbacks:** Executes I/O callbacks deferred from earlier cycles.
3. **Idle, Prepare:** Internal Node operations.
4. **Poll Phase:** Retrieves new I/O events, reads network sockets, executes I/O callbacks.
5. **Check Phase:** Executes `setImmediate()` callbacks.
6. **Close Callbacks:** Handles socket termination (`socket.on('close')`).
*Special Note:* **Microtask Queues** (`process.nextTick()` and `Promise.then()`) run immediately after each phase before transitioning to the next phase.

### Q3: What is the difference between a Buffer and a Stream in Node.js?
**Answer:**
- **Buffer:** A chunk of raw binary memory allocated outside the V8 heap (useful for holding fixed binary data, like an image or encryption key).
- **Stream:** A continuous sequence of data chunks transferred piece-by-piece over time. Streaming prevents out-of-memory errors because an entire 50MB file does not need to be buffered into RAM all at once.

### Q4: Why use `crypto.createHash('sha256')` instead of MD5 or SHA-1?
**Answer:** MD5 and SHA-1 suffer from proven cryptographic collision vulnerabilities (two different inputs producing the same hash). SHA-256 produces a 256-bit hash with zero known practical collisions, making it secure for healthcare audit chains and regulatory compliance.
