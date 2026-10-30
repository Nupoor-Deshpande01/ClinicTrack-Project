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

### Where each part lives in the browser

| URL                                     | What it is                                       |
| --------------------------------------- | ------------------------------------------------ |
| `http://localhost:5173`                 | The React clinic app (login → dashboard)         |
| `http://localhost:5173/site/`           | The Bootstrap marketing site from `public-site/` |
| `http://localhost:5173/site/tools.html` | BMI, paediatric dose and slot-picker tools       |
| `http://localhost:5000/api/health`      | API health (uptime, memory, DB state)            |

`/site/` is `express.static` for `public-site/`, so no second server is needed while
developing. For the course submission the marketing site is still deployed to Tomcat on
its own — see [docs/TOMCAT_SETUP.md](docs/TOMCAT_SETUP.md) — or opened directly as a file.

### Wow-feature screens

| URL                | What it shows                                               |
| ------------------ | ----------------------------------------------------------- |
| `/queue`           | Live waiting-room queue; issue tokens, call/done/skip       |
| `/queue/board`     | Full-screen "Now Serving" board for a second display        |
| `/prescriptions`   | Recent prescriptions; download the PDF, open the QR page    |
| `/verify/:qrToken` | Public QR page — no login needed                            |
| `/analytics`       | Visits per day, peak hours, top diagnoses, new vs returning |
| `/audit`           | Hash-chained trail + **Verify integrity**                   |

Socket.IO shares the API port; the Vite dev proxy forwards `/socket.io`.

## Documentation

| File                                                                                 | Contents                                                        |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| [docs/API.md](docs/API.md)                                                           | Every endpoint: payloads, roles, responses and error catalogue  |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                                             | Vercel (client) + Render (API) + MongoDB Atlas                  |
| [docs/TOMCAT_SETUP.md](docs/TOMCAT_SETUP.md)                                         | Deploying `public-site/` to Apache Tomcat                       |
| [docs/clinictrack.postman_collection.json](docs/clinictrack.postman_collection.json) | Importable Postman collection (30 requests, auto-saves the JWT) |

## Syllabus coverage (quick map)

| Practical / outcome          | Where it lives                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| HTML5, CSS3, Bootstrap 5     | `public-site/` (landing, doctors carousel, appointment form)                                 |
| Vanilla JS, JSON + arrays    | `public-site/js/appointment.js`, `chat.js`, `tools.js`                                       |
| ReactJS, routing, validation | `client/src` (RHF + Yup schemas, role-guarded routes)                                        |
| NodeJS core modules          | `crypto`/`events` (audit chain), `fs`/`stream` (exports), `os` (health), `path`, `node-cron` |
| ExpressJS, REST + middleware | `server/app.js`, `server/routes`, `server/middleware`                                        |
| MongoDB with Mongoose        | `server/models` + aggregation in `server/controllers/analytics.controller.js`                |
| Client vs server validation  | Yup in `client/src/validation/schemas.js` vs express-validator in every route                |

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
- [x] Prescription builder + PDF
- [x] Admin users + appointments pages
- [x] Live queue board
- [x] Analytics screen
- [x] Audit log + "Verify Integrity" pass/fail states
- [x] Public QR verification page
- [x] Dark mode + mobile layout

## Modules in progress

- **Phase 0 (done):** monorepo scaffold, git, linting, env files, README skeleton.
- **Phase 1 (done):** public-site (landing, appointment form, chat widget, tools, Tomcat guide).
- **Phase 2 (done):** backend foundation (models, auth, patients, versioned visits, seed, smoke tests).
- **Phase 3 (done):** React app — theme + dark mode, sidebar/topbar shell, JWT auth + role guards,
  dashboard, patients (list/register/profile), visit form, timeline, diff viewer, prescription
  builder, appointments and admin users screens.
- **Phase 4 (done):** wow features — Git-style timeline/diff/rollback and the allergy alert (shipped
  in Phase 3), tamper-evident audit log with _Verify integrity_, PDF prescription with QR +
  public verification page, Socket.IO live queue and Now Serving board, analytics reports
  (visits per day, top diagnoses, new vs returning, peak hours), and streamed JSON/CSV exports.
- **Phase 5 (done):** polish — full [API.md](docs/API.md), Postman collection, deployment guide,
  vendor chunk splitting, responsive pass over every screen at 390 px, consistent
  loading/error/empty states, and a stray duplicate heading removed.
