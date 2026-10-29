/**
 * HttpError.js — throw this anywhere in a controller to fail a request with
 * a consistent status code. The central error handler (middleware/error.js)
 * turns it into the standard JSON envelope { success, message, errors }.
 */
class HttpError extends Error {
  /**
   * @param {number} statusCode e.g. 400, 401, 403, 404, 409, 422, 500
   * @param {string} message human-readable message
   * @param {Array<{field?: string, message: string}>} [errors] per-field details
   */
  constructor(statusCode, message, errors) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

module.exports = HttpError;
