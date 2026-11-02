# Middlewares Implementation in ClinicTrack

## 1. Executive Overview

In **ClinicTrack**, **Middleware** functions form the backbone of the Express.js request-response processing pipeline. They act as automated checkpoints that intercept incoming HTTP requests, enforce security constraints, verify user credentials, validate input payloads, and handle unexpected errors.

### The Middleware Contract:
Every standard Express middleware adheres to the three-argument signature:
$$\text{middlewareFunction}(req, res, next)$$
- `req`: The incoming HTTP Request object (can be inspected or modified).
- `res`: The outgoing HTTP Response object (can send headers, JSON, or terminate the request).
- `next`: The callback function that relinquishes control to the subsequent middleware in the pipeline.

---

## 2. Inventory of Custom Middlewares in ClinicTrack

```
server/middleware/
├── auth.js        # protect (JWT verification) & authorize (RBAC role guards)
├── validate.js    # express-validator result handler & field error extractor
└── error.js       # 4-argument centralized error handler (HttpError formatter)
```

---

## 3. Deep-Dive Code Walkthroughs

### A. Authentication Middleware: `protect` (`server/middleware/auth.js`)
The `protect` middleware ensures that only requests with a valid, non-expired JSON Web Token (JWT) can access protected clinical routes.

```javascript
// server/middleware/auth.js (Lines 11-29)
function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  // 1. Check scheme and presence
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'No token provided — log in first.'));
  }

  try {
    // 2. Cryptographically verify signature using server secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Mutate req by attaching authenticated user claims
    req.user = { id: decoded.sub, name: decoded.name, role: decoded.role };

    // 4. Pass execution to next middleware
    return next();
  } catch (err) {
    const msg =
      err.name === 'TokenExpiredError' ? 'Session expired — log in again.' : 'Invalid token.';
    return next(new HttpError(401, msg));
  }
}
```

### B. Role-Based Access Control (RBAC) Middleware: `authorize` (`server/middleware/auth.js`)
`authorize` is a **higher-order function** (a function that returns a middleware) that restricts an endpoint to specific roles (`doctor`, `staff`, `admin`).

```javascript
// server/middleware/auth.js (Lines 31-42)
function authorize(...roles) {
  return (req, res, next) => {
    // 1. Ensure user has passed protect first
    if (!req.user) {
      return next(new HttpError(401, 'Authentication required.'));
    }

    // 2. Check if user's role is in the allowed list
    if (!roles.includes(req.user.role)) {
      return next(
        new HttpError(403, `Only ${roles.join(' or ')} accounts may perform this action.`)
      );
    }

    // 3. Authorized — proceed
    return next();
  };
}
```

#### Usage in Route Definition:
```javascript
// Reception staff can register a patient, but ONLY doctor/admin can update clinical notes:
router.post('/', authorize('doctor', 'staff', 'admin'), createPatient);
router.put('/:id', authorize('doctor', 'admin'), updatePatient);
```

### C. Server-Side Validation Middleware: `validate` (`server/middleware/validate.js`)
Acts as a bridge between `express-validator` declarative rules and our centralized error pipeline:

```javascript
// server/middleware/validate.js (Lines 14-29)
function validate(rules) {
  const handleResult = (req, res, next) => {
    const result = validationResult(req);

    // If validation errors exist, halt request and forward HTTP 422
    if (!result.isEmpty()) {
      return next(
        new HttpError(
          422,
          'Validation failed',
          result.array().map(e => ({ field: e.path, message: e.msg }))
        )
      );
    }
    return next();
  };

  // Return the validation rules followed by the result checker
  return [...rules, handleResult];
}
```

### D. Centralized Error Handler Middleware (`server/middleware/error.js`)
Placed as the **absolute last middleware** in `server/app.js`. It catches any error passed via `next(err)`:

```javascript
// server/middleware/error.js (Lines 9-33)
function centralErrorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = Array.isArray(err.errors) ? err.errors : undefined;

  // Intercept Mongoose-specific validation errors and convert to 422
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Validation failed';
    errors = Object.values(err.errors).map(e => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Safe logging: never dump full stacks with sensitive medical passwords
  console.error(`[${req.method} ${req.originalUrl}] ${statusCode}: ${message}`);

  if (!res.headersSent) {
    res.status(statusCode).json({ success: false, message, errors });
  }
}
```

---

## 4. Third-Party Security Middlewares in `server/app.js`

1. **`helmet()`:** Automatically sets 15 HTTP security headers (e.g., `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`).
2. **`cors()`:** Authorizes cross-origin HTTP requests coming strictly from the React client URL (`CLIENT_URL`).
3. **`express.json({ limit: '1mb' })`:** Parses incoming JSON request bodies and rejects malicious payloads exceeding 1 megabyte.
4. **`express-rate-limit`:** Throttles incoming IP requests to prevent Denial-of-Service (DoS) and credential brute-forcing:
   - General API: 500 requests per 15 minutes.
   - Login Route (`/api/auth/login`): 20 attempts per 15 minutes.
5. **`morgan('dev')`:** Formats concise colored HTTP request logs in the terminal console.

---

## 5. Examiner Viva & Defense Guide

### Q1: What is a Higher-Order Middleware? Give an example from ClinicTrack.
**Answer:** A higher-order middleware is a function that takes configuration parameters and returns a standard Express middleware function `(req, res, next)`. In ClinicTrack, `authorize('doctor', 'admin')` is a higher-order middleware: it accepts role strings and returns a custom closure checking whether `req.user.role` matches those roles.

### Q2: Why attach `req.user` inside the `protect` middleware?
**Answer:** Because HTTP is stateless. Once `jwt.verify()` confirms the user's token signature, storing `{ id, name, role }` directly on the `req` object makes the authenticated user's identity available to all downstream middleware and controller functions without querying the database again.

### Q3: What happens if an error is thrown inside an asynchronous middleware?
**Answer:** In raw Express 4, unhandled promise rejections inside `async` middleware do not trigger the error handler and cause the Node process to crash. ClinicTrack solves this by importing `express-async-errors` in `server/app.js`, which automatically catches rejected Promises and routes them to `next(err)`.
