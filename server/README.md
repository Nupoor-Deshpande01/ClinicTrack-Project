# ClinicTrack · server (Express + MongoDB)

RESTful API for ClinicTrack — built in **Phases 2–4**.

Planned layout:

```
server/
  models/        Mongoose models (User, Patient, Visit, Prescription, AuditLog, QueueToken, Appointment)
  routes/        Express routers per resource
  controllers/   Request handlers
  middleware/    auth, role guard, validation, error handler
  services/      audit chain, analytics, export/backup, queue events
  seed/          Dummy data script (doctors, staff, admin, 30 patients, varied visits)
  utils/         Shared helpers
```

Run `npm install` inside this folder (or from the repo root) and copy
`.env.example` to `.env` before starting.
