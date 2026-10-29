/**
 * error.js — the LAST middleware in the chain. Every error thrown or passed
 * with next(err) from any route ends here and leaves the API as one
 * consistent JSON shape:
 *   { success: false, message: "...", errors?: [{ field, message }] }
 */
const mongoose = require('mongoose');

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
function centralErrorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = Array.isArray(err.errors) ? err.errors : undefined;

  // Turn Mongoose "this field is required/unique" errors into 422 field errors.
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Validation failed';
    errors = Object.values(err.errors).map(e => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Quality rule: log the message only — never full stack dumps that could
  // contain documents with password hashes.
  console.error(`[${req.method} ${req.originalUrl}] ${statusCode}: ${message}`);
  if (errors) console.error('  fields:', errors.map(e => e.field).join(', '));

  if (!res.headersSent) {
    res.status(statusCode).json({ success: false, message, errors });
  }
}

module.exports = { centralErrorHandler };
