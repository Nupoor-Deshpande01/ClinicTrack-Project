# Express.js Implementation in ClinicTrack

## 1. Executive Overview

In **ClinicTrack**, **Express.js (v4.x)** is the web application and REST API framework running on top of Node.js. It organizes incoming HTTP requests, enforces security policies, coordinates authentication and authorization, and routes requests to business controllers.

### Why Express.js was chosen:
- **Middleware Pipeline:** Allows composing sequential layers of security (Helmet, CORS, Rate Limiting), input validation, logging, and error handling.
- **Modular Routing:** Enables breaking the application into clean resource routers (`auth.routes.js`, `patient.routes.js`, `visit.routes.js`, etc.) rather than a monolithic route file.
- **Standardized HTTP Abstractions:** Simplifies parsing JSON request bodies, setting status codes (`res.status(201)`), and returning standard JSON payloads.
- **Centralized Error Propagation:** Express catches unhandled exceptions and routes them through a single 4-argument error handler.

---

## 2. Directory Structure & Express Map

```
server/
├── app.js                        # Express factory function createApp() & middleware chain
├── utils/
│   └── HttpError.js              # Custom Error subclass carrying HTTP status codes
├── middleware/
│   ├── auth.js                   # Authentication (protect) & Authorization (authorize)
│   ├── validate.js               # express-validator result handler
│   └── error.js                  # 4-argument centralized error handler
└── routes/
    ├── auth.routes.js            # /api/auth
    ├── patient.routes.js         # /api/patients
    ├── visit.routes.js           # /api/visits
    ├── prescription.routes.js    # /api/prescriptions
    ├── appointment.routes.js     # /api/appointments
    ├── queue.routes.js           # /api/queue
    ├── audit.routes.js           # /api/audit
    ├── analytics.routes.js       # /api/analytics
    ├── user.routes.js            # /api/users
    └── export.routes.js          # /api/export
```

---

## 3. Deep-Dive Middleware Pipeline Architecture

### A. The Application Factory (`server/app.js`)
Instead of calling `app.listen()` directly inside `app.js`, ClinicTrack exports an application factory:

```javascript
// server/app.js (Lines 36-38, 110-113)
function createApp() {
  const app = express();
  // ... configure middleware and routes
  return app;
}
module.exports = createApp;
```
**Advantage:** This allows smoke testing scripts (`server/scripts/smoke.js`) and integration tests to instantiate the app in memory without binding network ports.

### B. Strict Sequential Middleware Order
Middleware execution order is critical for security and performance. In `server/app.js`, the pipeline is configured in this precise sequence:

```
[Incoming Request]
       │
       ▼
1. express.static('/site')       ──► Serves public marketing site directly
       │
       ▼
2. helmet()                      ──► Injects HTTP security headers (HSTS, XSS)
       │
       ▼
3. cors()                        ──► Whitelists React frontend origin
       │
       ▼
4. morgan('dev')                 ──► Logs method, URL, status code, response time
       │
       ▼
5. express.json({ limit: '1mb' })──► Parses incoming JSON; limits payload size to 1MB
       │
       ▼
6. rateLimit()                   ──► Blocks brute-force requests (20/15min login, 500/15min API)
       │
       ▼
7. Resource Routers              ──► Evaluates JWT, executes validation, calls controllers
       │
       ▼
8. 404 Catch-All Handler        ──► Handles undefined endpoints
       │
       ▼
9. centralErrorHandler           ──► 4-argument centralized error handler
```

### C. Async Error Handling via `express-async-errors`
By default in Express 4, if an asynchronous controller function throws an error or rejects a Promise, the process crashes unless wrapped in a `try/catch` block.
ClinicTrack includes:
```javascript
// server/app.js (Line 13)
require('express-async-errors');
```
This automatically routes rejected Promises inside `async` route handlers directly into the centralized error handling middleware without requiring boilerplate `try/catch` blocks in every controller.

### D. Centralized Error Handler (`server/middleware/error.js`)
Express distinguishes error-handling middleware by its **4-argument signature**: `(err, req, res, next)`.

```javascript
// server/middleware/error.js
function centralErrorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = Array.isArray(err.errors) ? err.errors : undefined;

  // Convert Mongoose validation errors into 422 HTTP responses
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Validation failed';
    errors = Object.values(err.errors).map(e => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  console.error(`[${req.method} ${req.originalUrl}] ${statusCode}: ${message}`);

  if (!res.headersSent) {
    res.status(statusCode).json({ success: false, message, errors });
  }
}
```

---

## 4. Examiner Viva & Defense Guide

### Q1: What is Express.js and why use it over raw Node.js `http`?
**Answer:** Raw Node.js `http.createServer()` requires manual URL regex matching, query string parsing, stream buffer concatenation for request bodies, and manual header setting. Express.js provides high-level routing (`app.get()`, `app.post()`), a pluggable middleware pipeline, and standard request/response abstractions.

### Q2: What is Middleware in Express? What happens if you forget `next()`?
**Answer:** A middleware function is any function that has access to the Request object (`req`), Response object (`res`), and the next middleware function (`next`). Middleware can execute code, modify `req` and `res`, terminate the cycle (`res.send()`), or pass execution to the next handler by calling `next()`. If a middleware neither sends a response nor calls `next()`, the client request **hangs indefinitely**.

### Q3: How does Express differentiate between regular middleware and error-handling middleware?
**Answer:** By the function's arity (number of declared parameters). Regular middleware accepts **2 or 3 arguments** `(req, res, next)`. Error-handling middleware must declare **exactly 4 arguments**: `(err, req, res, next)`. Even if the last argument is unused, Express checks `fn.length === 4` to identify it as an error handler.

### Q4: What is CORS and why must it be configured in Express?
**Answer:** Cross-Origin Resource Sharing (CORS) is a browser security mechanism enforced by the Same-Origin Policy (SOP). Browsers block web pages from sending AJAX/fetch requests to a different origin (protocol, domain, or port). Because our React frontend runs on port 5173 (or Vercel) and our Express server runs on port 5000 (or Render), Express must send the `Access-Control-Allow-Origin` header to permit cross-origin requests.
