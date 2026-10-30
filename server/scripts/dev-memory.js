/**
 * dev-memory.js — run the API against a disposable in-memory MongoDB.
 * Handy when MongoDB is not installed locally (e.g. quick demos / CI).
 * Data disappears when the process stops.
 *
 *   cd server && npm run dev:memory
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-memory-demo-secret-change-me';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDB } = require('../config/db');
const { runSeed } = require('../seed/seed');
const createApp = require('../app');

(async () => {
  const memory = await MongoMemoryServer.create();
  await connectDB(memory.getUri('clinictrack'));
  await runSeed({ memory: true });
  console.log(
    'Demo accounts: doctor@clinic.test / Doctor@123 · staff@clinic.test / Staff@123 · admin@clinic.test / Admin@123'
  );

  const port = process.env.PORT || 5000;
  createApp().listen(port, () =>
    console.log(`ClinicTrack API (in-memory DB) on http://localhost:${port}`)
  );

  const stop = async () => {
    await memory.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch(err => {
  console.error('dev:memory failed:', err);
  process.exit(1);
});
