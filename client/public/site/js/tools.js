/**
 * tools.js — interactive clinic tools (Practical 2):
 *   1. BMI calculator
 *   2. Paediatric dose calculator (weight-based, with safety disclaimer)
 *   3. Appointment slot picker
 * Every tool validates its inputs first and shows precise inline errors.
 */
(function (window, document) {
  'use strict';

  const U = window.ClinicUtils;
  const $ = id => document.getElementById(id);

  /* ---------- 1. BMI calculator ---------- */
  function runBMI() {
    const wEl = $('bmi-weight');
    const hEl = $('bmi-height');
    const wErr = $('bmi-weight-error');
    const hErr = $('bmi-height-error');
    const out = $('bmi-result');
    let ok = true;

    const w = parseFloat(wEl.value);
    const h = parseFloat(hEl.value);
    ok &= U.setError(
      wEl,
      wErr,
      Number.isFinite(w) && w > 0 && w <= 400 ? '' : 'Enter weight in kg between 1 and 400.'
    );
    ok &= U.setError(
      hEl,
      hErr,
      Number.isFinite(h) && h > 50 && h <= 250 ? '' : 'Enter height in cm between 50 and 250.'
    );

    if (!ok) {
      out.classList.add('d-none');
      return;
    }

    // BMI = weight(kg) / height(m) ^ 2
    const bmi = w / Math.pow(h / 100, 2);
    const category =
      bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
    const color =
      category === 'Normal'
        ? 'ct-badge-success'
        : category === 'Obese'
          ? 'ct-badge-danger'
          : 'ct-badge';

    out.classList.remove('d-none');
    out.innerHTML = '';
    const strong = document.createElement('strong');
    strong.textContent = `BMI: ${bmi.toFixed(1)} — `;
    const badge = document.createElement('span');
    badge.className = `ct-badge ${color}`;
    badge.textContent = category;
    out.append(strong, badge);
  }

  /* ---------- 2. Paediatric dose calculator ---------- */
  function runDose() {
    const wEl = $('dose-weight');
    const mgEl = $('dose-mgkg');
    const freqEl = $('dose-frequency');
    const wErr = $('dose-weight-error');
    const mgErr = $('dose-mgkg-error');
    const out = $('dose-result');
    let ok = true;

    const w = parseFloat(wEl.value);
    const mgPerKg = parseFloat(mgEl.value);
    const freq = parseInt(freqEl.value, 10);
    ok &= U.setError(
      wEl,
      wErr,
      Number.isFinite(w) && w > 0 && w <= 90 ? '' : 'Enter weight in kg between 0.5 and 90.'
    );
    ok &= U.setError(
      mgEl,
      mgErr,
      Number.isFinite(mgPerKg) && mgPerKg > 0 && mgPerKg <= 500
        ? ''
        : 'Enter dose in mg/kg between 0.1 and 500.'
    );
    if (!ok) {
      out.classList.add('d-none');
      return;
    }

    // Single dose = weight x mg/kg/day / frequency (assume mg figure is per day).
    const singleDose = (w * mgPerKg) / freq;
    const dailyDose = w * mgPerKg;
    const capped = dailyDose > 4000; // safety cap for demo purposes only

    out.classList.remove('d-none');
    out.innerHTML = '';
    const p1 = document.createElement('div');
    p1.append(
      'Single dose: ',
      Object.assign(document.createElement('strong'), {
        textContent: `${singleDose.toFixed(1)} mg`,
      }),
      ` — total ${capped ? Math.min(dailyDose, 4000).toFixed(0) + ' mg/day, demo-capped' : dailyDose.toFixed(0) + ' mg/day,'}`
    );
    const p2 = document.createElement('div');
    p2.className = 'ct-text-muted mt-1';
    p2.textContent = `${dailyDose.toFixed(1)} mg/day, split into ${freq} doses.`;
    out.append(p1, p2);

    // Safety disclaimer is always displayed — this is a demo tool only.
    $('dose-disclaimer').classList.remove('d-none');
  }

  /* ---------- 3. Appointment slot picker ---------- */
  // Doctor, session and pre-booked slots as plain JSON data.
  const SLOTS = {
    morning: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'],
    evening: ['05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM'],
  };
  const DOCTORS = [
    'Dr. Anjali Deshmukh',
    'Dr. Rohan Jadhav',
    'Dr. Meera Kulkarni',
    'Dr. Vikram Patil',
  ];
  // Slots already taken (key: doctor|date|session|time).
  const booked = new Set(['Dr. Anjali Deshmukh|__demo|morning|10:00 AM']);

  function renderSlots(dateVal, session, doctor) {
    const wrap = $('slot-grid');
    wrap.textContent = '';
    $('slot-picked').textContent = '';

    // Demo booking key uses a single fixed date so there is always a taken slot.
    SLOTS[session].forEach(slot => {
      const key = `${doctor}|${session}|${slot}`;
      const taken =
        booked.has(key) ||
        (dateVal > U.todayISO() &&
          doctor === 'Dr. Anjali Deshmukh' &&
          session === 'morning' &&
          slot === '10:00 AM');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-ct-outline m-1 slot-btn';
      btn.textContent = slot;
      btn.disabled = taken;
      if (taken) {
        btn.classList.add('opacity-50', 'text-decoration-line-through');
      }
      btn.addEventListener('click', function () {
        wrap.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('btn-ct-primary'));
        btn.classList.add('btn-ct-primary');
        $('slot-picked').textContent = `${doctor} · ${session} session · ${slot} on ${dateVal}`;
      });
      wrap.appendChild(btn);
    });
  }

  function runSlotPicker() {
    const dateEl = $('slot-date');
    const sessEl = $('slot-session');
    const docEl = $('slot-doctor');
    if (!U.isNotPastDate(dateEl.value)) {
      U.setError(dateEl, $('slot-date-error'), 'Choose today or a future date.');
      $('slot-grid').textContent = '';
      $('slot-picked').textContent = '';
      return;
    }
    U.setError(dateEl, $('slot-date-error'), '');
    renderSlots(dateEl.value, sessEl.value, docEl.value);
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('bmi-submit').addEventListener('click', runBMI);
    $('dose-submit').addEventListener('click', runDose);

    // ---- Slot picker setup ----
    const docEl = $('slot-doctor');
    DOCTORS.forEach(d => {
      const opt = document.createElement('option');
      opt.textContent = d;
      docEl.appendChild(opt);
    });
    const dateEl = $('slot-date');
    dateEl.min = U.todayISO();
    dateEl.value = U.todayISO();
    $('slot-refresh').addEventListener('click', runSlotPicker);
    $('slot-form').addEventListener('submit', function (e) {
      e.preventDefault();
      runSlotPicker();
    });
    runSlotPicker(); // show today's slots immediately
  });
})(window, document);
