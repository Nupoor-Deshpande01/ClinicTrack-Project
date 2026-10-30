# Deployment

Three pieces, three hosts:

| Piece         | Host          | What it runs                                       |
| ------------- | ------------- | -------------------------------------------------- |
| `client`      | Vercel        | Static Vite build (SPA)                            |
| `server`      | Render        | Express API + Socket.IO (Node web service)         |
| Database      | MongoDB Atlas | The only database                                  |
| `public-site` | Apache Tomcat | Unchanged — see [TOMCAT_SETUP.md](TOMCAT_SETUP.md) |

Deploy the database first, then the API, then the client (the client needs the API URL
and the API needs the client URL for CORS and QR links).

---

## 1. MongoDB Atlas

1. Create a free **M0** cluster (region closest to the Render region, e.g. Mumbai).
2. **Database Access** → add a user with password authentication, e.g. `clinictrack_app`.
3. **Network Access** → allow `0.0.0.0/0` for the demo (Render has no fixed egress IPs
   unless you buy one). Tighten this later with Render's static outbound IPs.
4. **Connect → Drivers** → copy the SRV string and add the database name:

   ```
   mongodb+srv://clinictrack_app:<password>@cluster0.xxxxx.mongodb.net/clinictrack?retryWrites=true&w=majority
   ```

5. Seed it once from your machine (dummy data only):

   ```bash
   cd server
   MONGO_URI="mongodb+srv://…/clinictrack" npm run seed
   ```

   The seed wipes the collections it owns, so never point it at real data.

---

## 2. API on Render

Create a **Web Service** from this repository (Render reads `server/` directly; no
Docker needed).

| Setting           | Value                                                 |
| ----------------- | ----------------------------------------------------- |
| Root directory    | `server`                                              |
| Build command     | `npm install`                                         |
| Start command     | `npm start`                                           |
| Health check path | `/api/health`                                         |
| Instance type     | Free/Starter is fine for a demo (it sleeps when idle) |

Environment variables:

| Key          | Value                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------- |
| `MONGO_URI`  | the Atlas SRV string from step 1                                                             |
| `JWT_SECRET` | long random hex — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | `https://your-app.vercel.app` (CORS + QR links)                                              |
| `PORT`       | leave unset — Render injects its own                                                         |

Notes:

- **Never commit** `server/.env`; set the values in Render's dashboard.
- Render terminates TLS in front of the service, so the QR codes should point at the
  **client** (`CLIENT_URL`), not the API.
- Socket.IO needs no extra config: it shares the HTTP server and Render supports
  WebSockets on web services. The client connects to `VITE_API_URL` when one is set.
- Free instances sleep after 15 minutes of inactivity; the first request afterwards
  takes ~30 s. For a live demo, open the dashboard a minute before presenting.
- The nightly `node-cron` job runs only while the instance is awake — on a free plan it
  is best-effort. That is acceptable here because it only closes stale appointments and
  queue tokens.

Smoke-test the deployment:

```bash
curl https://your-api.onrender.com/api/health
curl -X POST https://your-api.onrender.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"doctor@clinic.test","password":"Doctor@123"}'
```

---

## 3. Client on Vercel

Create a **New Project** from the repository.

| Setting              | Value                                        |
| -------------------- | -------------------------------------------- |
| Root directory       | `client`                                     |
| Framework preset     | Vite                                         |
| Build command        | `npm run build`                              |
| Output directory     | `dist`                                       |
| Environment variable | `VITE_API_URL=https://your-api.onrender.com` |

`client/vercel.json` rewrites every path to `index.html`, so deep links such as
`/patients/…` and the public QR page `/verify/:token` survive a refresh.

Because `VITE_API_URL` is baked in at build time, changing it requires a redeploy.
Without it the client calls `/api` on its own origin, which only works locally through
the Vite dev proxy.

---

## 4. Order of operations & checklist

1. Atlas cluster + user + network rule → `MONGO_URI`.
2. Render service with `MONGO_URI`, `JWT_SECRET`, and a placeholder `CLIENT_URL`.
3. Seed Atlas from your machine (step 1.5).
4. Vercel project with `VITE_API_URL` pointing at Render.
5. Update Render's `CLIENT_URL` to the final Vercel URL and redeploy the API.
6. Verify manually:
   - [ ] Login with the doctor demo account; dashboard stat cards show data.
   - [ ] Reception account cannot open `/analytics`, `/audit`, `/prescriptions`.
   - [ ] Edit a visit twice → timeline shows v1…v3 → diff highlights changes → rollback adds v4.
   - [ ] Write a prescription → PDF downloads → open `/verify/<token>` in a private window
         (no session) → "Valid prescription".
   - [ ] Open `/queue` in one tab and `/queue/board` in another → call a token → the board
         updates without a refresh (proves WebSockets, not just polling).
   - [ ] Audit Log → **Verify integrity** → "Chain intact".
   - [ ] Refresh a deep link (e.g. `/patients/<id>`) → the SPA still loads.

## 5. Known constraints

- No file uploads; the only persistent artefacts are PDFs generated on demand and
  backups streamed from a temp file that is deleted afterwards.
- PDFs and CSV backups are generated on the API instance, so `server/backups/` is
  ephemeral on Render (fine — the file is deleted after streaming).
- CORS uses a single `CLIENT_URL`. Preview deployments get their own Vercel domains; add
  them by widening the CORS origin (or deploy previews against the same API with a
  second allowed origin) if you demo from a preview URL.
- The demo accounts are seeded with published passwords — never reuse this seed for real
  patient data.
