# ClinicTrack · Public Website

Static Bootstrap 5 website for **Siddhivinayak Clinic** (Phase 1). It contains:

- `index.html` — landing page (hero, about, services, testimonials, doctors carousel,
  contact banner, footer), the appointment request form with vanilla-JS validation and
  the in-memory JSON/array store, plus the rule-based chat widget.
- `tools.html` — BMI calculator, paediatric dose calculator and appointment slot picker.
- `css/theme.css` — design tokens shared with the React app; `css/site.css` — site styles.
- `js/` — `appointment.js`, `chat.js` + `chat-data.js` (intent JSON), `tools.js`,
  `demo-seed.js` (a sample request so the table is not empty), `site-theme.js` (dark mode).
- `WEB-INF/web.xml` — makes the folder a deployable Tomcat web application.

## View it in the browser

The site is plain HTML/CSS/JS — no build step.

| How                                                         | Command / URL                                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Through the API (recommended, same as `npm run dev:memory`) | `http://localhost:5173/site/` or `http://localhost:5000/site/`                    |
| Any static server                                           | `cd public-site && npx serve .` (or `python3 -m http.server 8080`)                |
| Double-click                                                | open `index.html` directly; only the Tomcat deployment adds `/WEB-INF` behaviours |

The API serves this folder with `express.static` at `/site`, and the React login screen's
“Back to the clinic website” link points there.

## Deploy to Apache Tomcat

Drop the folder into `webapps/` (then browse `http://localhost:8080/public-site/`) or
build a WAR — full walkthrough in [`../docs/TOMCAT_SETUP.md`](../docs/TOMCAT_SETUP.md).

Note that the Bootstrap CSS/JS, Bootstrap Icons and Plus Jakarta Sans come from CDNs, so
this page needs an internet connection; the Tomcat guide explains the offline option.
