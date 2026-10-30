/**
 * jobs.service.js — scheduled maintenance with node-cron.
 *
 * Runs just after midnight: appointments still "scheduled" for a past day are
 * marked cancelled (nobody logged the visit), and yesterday's unfinished queue
 * tokens are closed. Every run writes one audit entry, so the nightly work is
 * as traceable as a human action.
 *
 * Started by index.js (a real server); the smoke test calls runNightly() once
 * instead of waiting for the cron.
 */
const cron = require('node-cron');
const Appointment = require('../models/appointment.model');
const QueueToken = require('../models/queueToken.model');
const { emitAudit } = require('./audit.service');
const { dayKey } = require('../controllers/queue.controller');

async function runNightly() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [appointments, tokens] = await Promise.all([
    Appointment.updateMany(
      { status: 'scheduled', scheduledAt: { $lt: startOfToday } },
      { $set: { status: 'cancelled' } }
    ),
    QueueToken.updateMany(
      { dayKey: { $lt: dayKey() }, status: { $in: ['waiting', 'serving'] } },
      { $set: { status: 'skipped', completedAt: new Date() } }
    ),
  ]);

  emitAudit({
    actorRole: 'system',
    actorName: 'Scheduler',
    action: 'DAILY_MAINTENANCE',
    entity: 'System',
    details: {
      appointmentsCancelled: appointments.modifiedCount,
      queueTokensClosed: tokens.modifiedCount,
    },
  });

  return {
    appointmentsCancelled: appointments.modifiedCount,
    queueTokensClosed: tokens.modifiedCount,
  };
}

/** Register the cron job (returns the task so callers can stop it). */
function startJobs() {
  return cron.schedule('10 0 * * *', () => {
    runNightly().catch(err => console.error('nightly job failed:', err.message));
  });
}

module.exports = { runNightly, startJobs };
