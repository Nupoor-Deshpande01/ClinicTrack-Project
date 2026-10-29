/**
 * validate.js — server-side validation wrapper for express-validator.
 *
 * Usage in a route file:
 *   router.post('/', protect, validate(patientRules), ctrl.createPatient);
 *
 * This is INDEPENDENT from the React client's Yup rules: even if someone
 * bypasses the browser (curl/Postman), the server re-checks everything and
 * answers with the standard { success:false, errors:[{field,message}] } shape.
 */
const { validationResult } = require('express-validator');
const HttpError = require('../utils/HttpError');

function validate(rules) {
  const handleResult = (req, res, next) => {
    const result = validationResult(req);
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
  return [...rules, handleResult];
}

module.exports = { validate };
