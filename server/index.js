/**
 * index.js — entry point: check env, connect MongoDB, start listening.
 */
const { connectDB } = require('./config/db');
const createApp = require('./app');

async function main() {
  if (!process.env.JWT_SECRET) {
    console.error(
      'JWT_SECRET is missing. Copy server/.env.example to server/.env and generate a random string:'
    );
    console.error("  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"");
    process.exit(1);
  }

  let dbReady = false;
  try {
    await connectDB(process.env.MONGO_URI);
    dbReady = true;
  } catch (err) {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  }

  const app = createApp();
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(
      `ClinicTrack API listening on http://localhost:${port} (db: ${dbReady ? 'connected' : 'down'})`
    );
  });
}

main();
