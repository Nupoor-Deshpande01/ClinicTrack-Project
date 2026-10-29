# API.md

RESTful API reference for ClinicTrack. Full endpoint-by-endpoint page lands in
**Phase 5**; until then this file tracks which groups exist.

| Group              | Base path                                 | Status  |
| ------------------ | ----------------------------------------- | ------- |
| Auth               | `/api/auth`                               | Phase 2 |
| Patients           | `/api/patients`                           | Phase 2 |
| Visits (versioned) | `/api/visits`, `/api/patients/:id/visits` | Phase 2 |
| Prescriptions      | `/api/prescriptions`                      | Phase 4 |
| Audit log          | `/api/audit`                              | Phase 4 |
| Analytics          | `/api/analytics`                          | Phase 4 |
| Live queue         | `/api/queue` (Socket.IO)                  | Phase 4 |
| Export / backup    | `/api/export`                             | Phase 4 |

Conventions (to be honored by every endpoint once built):

- Auth: `Authorization: Bearer <JWT>` (except login and the public QR verify route).
- Responses: `{ success: boolean, message: string, data?: any, errors?: [...] }`.
- Server-side validation runs with `express-validator`, independent of the
  client's React Hook Form + Yup rules.
