/**
 * app.js — wires the Express application (no listen; index.js does that so
 * the smoke test can require the app without binding a port).
 *
 * Middleware order (standard hardening):
 *   helmet → cors → morgan/rate-limit → JSON parser → routers → error handler
 */
require('dotenv').config(); // loads server/.env when run from this folder

// Patches Express 4 so `throw` inside an async controller reaches the central
// error handler instead of crashing the process (an async route handler has
// no error param). Must be required BEFORE any route modules.
require('express-async-errors');

const path = require('path'); // core module: locates the static marketing site
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const os = require('os'); // core module: powers the health endpoint

const authRoutes = require('./routes/auth.routes');
const patientRoutes = require('./routes/patient.routes');
const visitRoutes = require('./routes/visit.routes');
const prescriptionRoutes = require('./routes/prescription.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const userRoutes = require('./routes/user.routes');
const queueRoutes = require('./routes/queue.routes');
const auditRoutes = require('./routes/audit.routes');
const exportRoutes = require('./routes/export.routes');
const { centralErrorHandler } = require('./middleware/error');
const { isDBConnected } = require('./config/db');

function createApp() {
  const app = express();

  // ---- public marketing website (public-site/) ----
  // Served before helmet/JSON parsing so its CDN assets and inline handlers keep
  // working unchanged, and so the same URL (/site/) works in development and on
  // Render. For the course submission the canonical host is still Tomcat — see
  // docs/TOMCAT_SETUP.md.
  app.use('/site', express.static(path.join(__dirname, '..', 'public-site')));

  // ---- security + logging middleware ----
  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_URL || true, credentials: true }));
  app.use(morgan('dev'));
  app.use(express.json({ limit: '1mb' }));

  // Blocks abusive traffic — the demo never needs more than this.
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 500,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    })
  );
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    })
  );

  // ---- health endpoint (Node os module: uptime + memory) ----
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      db: isDBConnected() ? 'connected' : 'disconnected',
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

  // ---- REST routers ----
  app.use('/api/auth', authRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api/visits', visitRoutes);
  app.use('/api/visits', prescriptionRoutes); // POST/GET prescription by visit
  app.use('/api/prescriptions', prescriptionRoutes.prescriptions); // PDF + public QR verify
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/queue', queueRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/export', exportRoutes);

  // ---- unknown route + central error handler (ALWAYS last) ----
  app.use((req, res) => {
    res
      .status(404)
      .json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found.` });
  });
  app.use(centralErrorHandler);

  return app;
}

module.exports = createApp;
