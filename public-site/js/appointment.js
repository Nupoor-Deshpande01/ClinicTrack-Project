/* global ClinicDemoSeed */
/**
 * appointment.js — Practical 1/2 demo: form validation BEFORE saving, and a
 * JSON array as the in-memory store for appointment requests (add, edit, delete).
 *
 * Data shape for one appointment request:
 *   { id, name, phone, service, date, notes, createdAt }
 */
(function (window, document) {
  'use strict';

  const U = window.ClinicUtils;

  // The "database": a plain JavaScript array holding JSON objects, in memory.
  const appointments = [
    {
      id: 1,
      name: 'Ravi Kulkarni',
      phone: '9822011234',
      service: 'General Checkup',
      date: ClinicDemoSeed.nextFreeDate ? ClinicDemoSeed.nextFreeDate(3) : '',
      notes: 'Prefers morning slot',
      createdAt: new Date().toISOString(),
    },
  ];

  let editingId = null; // which appointment is currently loaded into the form

  // Field constants: the <input> element, its inline error <span>.
  const $ = sel => document.querySelector(sel);
  let nameEl, phoneEl, serviceEl, dateEl, notesEl;
  let nameErr, phoneErr, serviceErr, dateErr;

  function fields() {
    return [
      [
        nameEl,
        nameErr,
        U.isValidName(nameEl.value) ? '' : 'Please enter your full name (letters and spaces only).',
      ],
      [
        phoneEl,
        phoneErr,
        U.isValidPhone(phoneEl.value)
          ? ''
          : 'Enter a valid Indian mobile number (10 digits, starts with 6-9).',
      ],
      [serviceEl, serviceErr, serviceEl.value ? '' : 'Please select a service.'],
      [dateEl, dateErr, U.isNotPastDate(dateEl.value) ? '' : 'Choose today or a future date.'],
    ];
  }

  /** Validate every field; returns true only when nothing is wrong. */
  function validateAll() {
    return fields().every(([el, err, msg]) => U.setError(el, err, msg));
  }

  function formData() {
    return {
      name: nameEl.value.trim(),
      phone: phoneEl.value.trim(),
      service: serviceEl.value,
      date: dateEl.value,
      notes: notesEl.value.trim(),
    };
  }

  function fillForm(a) {
    nameEl.value = a.name;
    phoneEl.value = a.phone;
    serviceEl.value = a.service;
    dateEl.value = a.date;
    notesEl.value = a.notes;
  }

  function resetForm() {
    editingId = null;
    $('#appointment-form').reset();
    fields().forEach(([el, err]) => U.setError(el, err, ''));
    $('#appointment-submit-btn').textContent = 'Request Appointment';
    $('#appointment-cancel-btn').classList.add('d-none');
  }

  /** Re-render the table from the array — the array is the single source of truth. */
  function renderTable() {
    const body = $('#appointment-table-body');
    const empty = $('#appointment-empty');
    body.textContent = ''; // clear without keeping old DOM
    if (appointments.length === 0) {
      empty.classList.remove('d-none');
      return;
    }
    empty.classList.add('d-none');

    // Newest first in the display (array keeps insertion order).
    [...appointments].reverse().forEach(a => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = a.name;

      const tdPhone = document.createElement('td');
      tdPhone.textContent = a.phone;

      const tdService = document.createElement('td');
      tdService.textContent = a.service;

      const tdDate = document.createElement('td');
      tdDate.textContent = a.date;

      const tdActions = document.createElement('td');
      tdActions.className = 'text-nowrap';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-sm btn-ct-outline me-1';
      editBtn.setAttribute('aria-label', `Edit appointment for ${a.name}`);
      editBtn.innerHTML = '<i class="bi bi-pencil"></i> Edit';
      editBtn.addEventListener('click', function () {
        editingId = a.id;
        fillForm(a);
        $('#appointment-submit-btn').textContent = 'Update Appointment';
        $('#appointment-cancel-btn').classList.remove('d-none');
        $('#appointment-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-sm btn-ct-danger';
      delBtn.setAttribute('aria-label', `Delete appointment for ${a.name}`);
      delBtn.innerHTML = '<i class="bi bi-trash"></i> Delete';
      delBtn.addEventListener('click', function () {
        const idx = appointments.findIndex(x => x.id === a.id);
        if (idx > -1 && confirm(`Delete appointment request for ${a.name}?`)) {
          appointments.splice(idx, 1);
          if (editingId === a.id) resetForm();
          renderTable();
        }
      });

      tdActions.append(editBtn, delBtn);
      tr.append(tdName, tdPhone, tdService, tdDate, tdActions);
      body.appendChild(tr);
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validateAll()) return; // save nothing if validation fails

    const data = formData();
    if (editingId === null) {
      // ADD: clone a new object into the array (never reuse the same object).
      const nextId = appointments.reduce((max, a) => Math.max(max, a.id), 0) + 1;
      appointments.push({ id: nextId, ...data, createdAt: new Date().toISOString() });
      showSuccessMessage(`Thank you ${data.name}! Your appointment request has been saved.`);
      resetForm();
    } else {
      // EDIT: replace the matching object with a fresh clone.
      appointments.forEach((a, i) => {
        if (a.id === editingId) appointments[i] = { ...a, ...data };
      });
      showSuccessMessage('Appointment request updated.');
      resetForm();
    }
    renderTable();
  }

  function showSuccessMessage(msg) {
    const box = $('#appointment-success');
    box.textContent = msg;
    box.classList.remove('d-none');
    clearTimeout(showSuccessMessage._t);
    showSuccessMessage._t = setTimeout(() => box.classList.add('d-none'), 4000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    nameEl = $('#apt-name');
    phoneEl = $('#apt-phone');
    serviceEl = $('#apt-service');
    dateEl = $('#apt-date');
    notesEl = $('#apt-notes');
    nameErr = $('#apt-name-error');
    phoneErr = $('#apt-phone-error');
    serviceErr = $('#apt-service-error');
    dateErr = $('#apt-date-error');

    dateEl.min = U.todayISO(); // never allow picking a past date in the picker
    $('#appointment-form').addEventListener('submit', handleSubmit);
    $('#appointment-cancel-btn').addEventListener('click', resetForm);

    // Validate each field as the user leaves it (live feedback).
    [nameEl, phoneEl, serviceEl, dateEl].forEach(el => {
      el.addEventListener('blur', validateAll);
    });

    renderTable();
  });
})(window, document);
