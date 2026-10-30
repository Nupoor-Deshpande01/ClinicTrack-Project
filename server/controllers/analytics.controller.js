/**
 * analytics.controller.js — dashboard numbers via MongoDB aggregation.
 * Full analytics screen (top diagnoses, peak hours) is Phase 4; this endpoint
 * already covers the four stat cards + the arrival chart.
 */
const Patient = require('../models/patient.model');
const Visit = require('../models/visit.model');
const Appointment = require('../models/appointment.model');
const User = require('../models/user.model');

/** GET /api/analytics/summary?months=6 */
async function summary(req, res) {
  const months = Math.min(12, Math.max(1, parseInt(req.query.months, 10) || 6));
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000 - 1);

  const [totalPatients, visitsToday, appointmentsToday, activeQueue] = await Promise.all([
    Patient.countDocuments(),
    Visit.countDocuments({ isCurrent: true, visitDate: { $gte: startOfToday, $lte: endOfToday } }),
    Appointment.countDocuments({
      scheduledAt: { $gte: startOfToday, $lte: endOfToday },
      status: 'scheduled',
    }),
    // Live queue arrives in Phase 4; reporting 0 now is honest, not broken UI.
    Promise.resolve(0),
  ]);

  // Pending follow-ups: patients whose most recent current visit is older
  // than 21 days (they were asked to come back and have not).
  const followUpCutoff = new Date(startOfToday.getTime() - 21 * 86400000);
  const lastVisits = await Visit.aggregate([
    { $match: { isCurrent: true } },
    { $group: { _id: '$patientId', lastVisit: { $max: '$visitDate' } } },
    { $match: { lastVisit: { $lt: followUpCutoff } } },
    { $count: 'count' },
  ]);
  const pendingFollowUps = lastVisits[0]?.count || 0;

  // Monthly arrivals for the last N months: patients IN (registered) and
  // patients OUT (seen at least once that month, unique patients).
  const monthLabels = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthLabels.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-IN', { month: 'short' }),
    });
  }
  const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const [registeredByMonth, seenByMonth] = await Promise.all([
    Patient.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Visit.aggregate([
      { $match: { visitDate: { $gte: since } } },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: '%Y-%m', date: '$visitDate' } },
            patient: '$patientId',
          },
        },
      },
      { $group: { _id: '$_id.month', count: { $sum: 1 } } },
    ]),
  ]);
  const inMap = new Map(registeredByMonth.map(r => [r._id, r.count]));
  const outMap = new Map(seenByMonth.map(r => [r._id, r.count]));

  const arrivalSeries = monthLabels.map(m => ({
    month: m.label,
    in: inMap.get(m.key) || 0,
    out: outMap.get(m.key) || 0,
  }));

  const doctors = await User.find({ role: 'doctor', isActive: true })
    .select('name specialty')
    .limit(6);

  res.json({
    success: true,
    data: {
      stats: { totalPatients, visitsToday, pendingFollowUps, activeQueue, appointmentsToday },
      arrivalSeries,
      doctors: doctors.map(d => ({
        id: d._id,
        name: d.name,
        specialty: d.specialty || 'General Medicine',
      })),
    },
  });
}

module.exports = { summary };
