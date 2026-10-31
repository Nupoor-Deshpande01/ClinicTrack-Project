/* exported ClinicDemoSeed */
/**
 * demo-seed.js — tiny helper that hands demo rows a plausible (future) date
 * so the starter appointment in the table is never in the past.
 */
const ClinicDemoSeed = {
  /** Date string (YYYY-MM-DD) n days from today. */
  nextFreeDate(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    const pad = x => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
};
