/**
 * clinic-utils.js — shared vanilla-JS helpers used by both index.html and
 * tools.html. Pure functions only (no DOM), so they are easy to demo in the
 * console: e.g. ClinicUtils.isValidPhone('9876543210').
 */
window.ClinicUtils = {
  /** Rule for appointment-type names: letters, spaces, dots and hyphens only. */
  isValidName(name) {
    return /^[A-Za-z][A-Za-z .-]{1,58}$/.test(String(name || '').trim());
  },

  /** Indian mobile number: 10 digits starting with 6, 7, 8 or 9. */
  isValidPhone(phone) {
    return /^[6-9]\d{9}$/.test(String(phone || '').trim());
  },

  /** YYYY-MM-DD string compared against today in local time (no Date pitfalls). */
  isNotPastDate(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    const pick = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return !Number.isNaN(pick.getTime()) && pick >= today;
  },

  /** Show or clear an inline error below a form field. */
  setError(fieldEl, errorEl, message) {
    if (message) {
      fieldEl.classList.add('is-invalid');
      errorEl.textContent = message;
      errorEl.hidden = false;
      return false;
    }
    fieldEl.classList.remove('is-invalid');
    errorEl.textContent = '';
    errorEl.hidden = true;
    return true;
  },

  /** YYYY-MM-DD for use in <input type="date" min=...>. */
  todayISO() {
    const t = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  },
};
