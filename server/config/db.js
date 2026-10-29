/**
 * db.js — MongoDB connection bootstrap (Mongoose).
 * Used by index.js (normal run) and the smoke test.
 */
const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) {
    throw new Error('MONGO_URI is missing. Copy server/.env.example to server/.env first.');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB connected → ${mongoose.connection.host}/${mongoose.connection.name}`);
}

/** True when mongoose has an active connection. */
function isDBConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDBConnected };
