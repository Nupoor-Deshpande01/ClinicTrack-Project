# ClinicTrack

A **version-tracked patient record system** for small clinics — pilot clinic:
**Siddhivinayak Clinic**. Patient records behave like Git repositories and each
visit like a commit:

- every edit **adds a new version** of a visit (nothing is overwritten),
- old versions can be **diffed** side by side and **restored** (rollback),
- every change lands in a **tamper-evident audit log** (SHA-256 hash chain).

Course: _Web Technology (2310362L)_ — T.Y. B.Tech, MIT Academy of Engineering.
Dummy data only, no real patient information.

## Monorepo layout

```
clinictrack/
  public-site/   Static Bootstrap 5 website + tools page (Tomcat-ready)   → Phase 1
  client/        React (Vite) + React Router app                          → Phase 3–4
  server/        Express REST API + MongoDB (Mongoose)                    → Phase 2–4
  docs/          README, API.md, TOMCAT_SETUP.md                          → grows per phase
```

## Tech stack

| Layer    | Tech                                                                         |
| -------- | ---------------------------------------------------------------------------- |
| Website  | HTML5, CSS3, Bootstrap 5, vanilla JS (JSON/array tools, chat widget), Tomcat |
| Client   | ReactJS, Vite, React Router, React Hook Form + Yup, Axios, Recharts          |
| Server   | NodeJS core modules, ExpressJS, express-validator, JWT, Socket.IO, pdfkit    |
| Database | MongoDB with Mongoose (the only database)                                    |

## Prerequisites

- Node.js ≥ 18 and npm ≥ 9
- MongoDB running locally on `mongodb://127.0.0.1:27017` (or a MongoDB Atlas URI)

## Setup (from the repo root)

```bash
# 1. install everything (installs all workspaces)
npm install

# 2. configure server environment
cp server/.env.example server/.env
#    then edit server/.env (MONGO_URI, JWT_SECRET, PORT, CLIENT_URL)
cp client/.env.example client/.env   # optional: API not on localhost:5000

# 3. lint / format checks
npm run lint
npm run format:check
```

## Scripts (root)

| Script                 | What it does                        |
| ---------------------- | ----------------------------------- |
| `npm run lint`         | ESLint over the whole monorepo      |
| `npm run lint:fix`     | ESLint with auto-fix                |
| `npm run format`       | Prettier — format all files         |
| `npm run format:check` | Prettier — CI-style format check    |
| `npm run seed`         | Seed dummy data into MongoDB        |
| `npm run dev:server`   | Start the Express API (`:5000`)     |
| `npm run dev:client`   | Start the Vite dev server (`:5173`) |
| `npm run build:client` | Production React build              |

### Run the API without installing MongoDB

```bash
cd server && npm run dev:memory   # in-memory MongoDB, auto-seeded, port 5000
cd client && npm run dev          # in a second terminal
```

`dev:memory` is a demo helper only — data disappears when the process stops.

## Demo logins _(set by the seed script)_

| Role              | Email                | Password     |
| ----------------- | -------------------- | ------------ |
| Doctor            | `doctor@clinic.test` | `Doctor@123` |
| Staff / reception | `staff@clinic.test`  | `Staff@123`  |
| Admin             | `admin@clinic.test`  | `Admin@123`  |

## Screenshot checklist _(to fill in as phases complete)_

- [x] Public landing page (hero, services, doctors, footer)
- [x] Appointment form with inline validation errors
- [x] Chat window widget
- [x] Tools page (BMI, paeds dose, slot picker)
- [x] Login screen
- [x] Dashboard (stat cards, arrival chart, specialists, appointments)
- [x] Patient list with search/filter/pagination
- [x] Visit form + validation errors
- [x] Visit timeline with versions
- [x] Side-by-side diff with red/green highlighting
- [ ] Prescription builder + PDF
- [ ] Admin users + appointments pages
- [ ] Live queue board
- [ ] Analytics screen
- [ ] Audit log + "Verify Integrity" pass/fail states
- [x] Dark mode + mobile layout

## Modules in progress

- **Phase 0 (done):** monorepo scaffold, git, linting, env files, README skeleton.
- **Phase 1 (done):** public-site (landing, appointment form, chat widget, tools, Tomcat guide).
- **Phase 2 (done):** backend foundation (models, auth, patients, versioned visits, seed, smoke tests).
- **Phase 3 (done):** React app — theme + dark mode, sidebar/topbar shell, JWT auth + role guards,
  dashboard, patients (list/register/profile), visit form, timeline, diff viewer, prescription
  builder, appointments and admin users screens.
- **Phase 4:** wow features (audit chain, allergy alerts, PDF+QR, live queue, analytics).
- **Phase 5:** polish, API.md, Postman collection, deployment notes.
