import api from './client';

/** All REST calls, grouped by resource. Components never touch axios directly. */

export const authApi = {
  login: body => api.post('/auth/login', body).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
};

export const patientsApi = {
  list: params => api.get('/patients', { params }).then(r => r.data),
  get: id => api.get(`/patients/${id}`).then(r => r.data.data),
  create: body => api.post('/patients', body).then(r => r.data),
  update: (id, body) => api.put(`/patients/${id}`, body).then(r => r.data),
};

export const visitsApi = {
  listForPatient: patientId => api.get(`/patients/${patientId}/visits`).then(r => r.data.data),
  create: (patientId, body) => api.post(`/patients/${patientId}/visits`, body).then(r => r.data),
  update: (id, body) => api.put(`/visits/${id}`, body).then(r => r.data),
  versions: id => api.get(`/visits/${id}/versions`).then(r => r.data),
  diff: (a, b) => api.get(`/visits/${a}/diff/${b}`).then(r => r.data.data),
  rollback: (id, targetVisitId) =>
    api.post(`/visits/${id}/rollback`, { targetVisitId }).then(r => r.data),
};

export const prescriptionsApi = {
  listForVisit: visitId => api.get(`/visits/${visitId}/prescriptions`).then(r => r.data.data),
  create: (visitId, body) => api.post(`/visits/${visitId}/prescription`, body).then(r => r.data),
  recent: () => api.get('/prescriptions').then(r => r.data.data),
  /** PDF arrives as bytes; the caller turns it into a download. */
  pdf: id => api.get(`/prescriptions/${id}/pdf`, { responseType: 'blob' }).then(r => r.data),
  /** Public endpoint: works without a session (the QR-scan page). */
  verify: qrToken => api.get(`/prescriptions/verify/${qrToken}`).then(r => r.data.data),
};

export const appointmentsApi = {
  listByDate: date => api.get('/appointments', { params: { date } }).then(r => r.data),
  create: body => api.post('/appointments', body).then(r => r.data),
  remove: id => api.delete(`/appointments/${id}`).then(r => r.data),
};

export const analyticsApi = {
  summary: (months = 6) =>
    api.get('/analytics/summary', { params: { months } }).then(r => r.data.data),
};

export const usersApi = {
  list: role => api.get('/users', { params: role ? { role } : {} }).then(r => r.data.data),
  create: body => api.post('/users', body).then(r => r.data),
};

export const queueApi = {
  today: () => api.get('/queue').then(r => r.data),
  add: body => api.post('/queue', body).then(r => r.data),
  setStatus: (id, status) => api.patch(`/queue/${id}`, { status }).then(r => r.data),
};

export const auditApi = {
  list: params => api.get('/audit', { params }).then(r => r.data),
  verify: () => api.get('/audit/verify').then(r => r.data),
};

export const exportApi = {
  /** Admin-only downloads; both come back as file streams (blobs). */
  backup: () => api.get('/export/backup', { responseType: 'blob' }).then(r => r.data),
  patientsCsv: () => api.get('/export/patients.csv', { responseType: 'blob' }).then(r => r.data),
};
