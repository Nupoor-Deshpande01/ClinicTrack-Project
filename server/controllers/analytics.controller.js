/**
 * analytics.controller.js — every dashboard/report number, computed by
 * MongoDB aggregation (no counting in JavaScript): stat cards, monthly
 * arrivals, 14-day visit trend, top diagnoses, new vs returning patients and
 * the clinic's peak hours.
 */
const Patient = require('../models/patient.model');
const Visit = require('../models/visit.model');
const Appointment = require('../models/appointment.model');
const QueueToken = require('../models/queueToken.model');
const User = require('../models/user.model');
const { dayKey } = require('./queue.controller');

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
    QueueToken.countDocuments({ dayKey: dayKey(), status: { $in: ['waiting', 'serving'] } }),
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

  // ---- analytics screen aggregations ----
  const last14 = new Date(startOfToday.getTime() - 13 * 86400000);
  // Local clinic hours, not UTC: the server and clinic share a timezone.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [visitsByDay, topDiagnoses, returningSplit, peakHours] = await Promise.all([
    Visit.aggregate([
      { $match: { visitDate: { $gte: last14 } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$visitDate' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Visit.aggregate([
      { $match: { isCurrent: true } },
      { $group: { _id: '$diagnosis', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    // Patients with exactly one current visit are "new", the rest "returning".
    Visit.aggregate([
      { $match: { isCurrent: true } },
      { $group: { _id: '$patientId', visits: { $sum: 1 } } },
      {
        $group: {
          _id: { $cond: [{ $gt: ['$visits', 1] }, 'returning', 'new'] },
          count: { $sum: 1 },
        },
      },
    ]),
    Visit.aggregate([
      { $match: { visitDate: { $gte: last14 } } },
      { $group: { _id: { $hour: { date: '$visitDate', timezone } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Fill the 14-day trend so quiet days show as zero instead of gaps.
  const dayMap = new Map(visitsByDay.map(d => [d._id, d.count]));
  const visitTrend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(last14.getTime() + i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    return {
      date: key,
      label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      count: dayMap.get(key) || 0,
    };
  });

  const split = Object.fromEntries(returningSplit.map(r => [r._id, r.count]));

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
      visitTrend,
      topDiagnoses: topDiagnoses.map(d => ({ diagnosis: d._id, count: d.count })),
      newVsReturning: [
        { name: 'New patients', value: split.new || 0 },
        { name: 'Returning patients', value: split.returning || 0 },
      ],
      peakHours: peakHours.map(h => ({
        hour: `${String(h._id).padStart(2, '0')}:00`,
        count: h.count,
      })),
    },
  });
}

module.exports = { summary };
