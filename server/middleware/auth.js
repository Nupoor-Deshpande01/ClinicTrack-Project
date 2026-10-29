/**
 * auth.js — JWT verification ("protect") and role guards.
 *
 * Usage:
 *   router.post('/', protect, authorize('doctor', 'admin'), handler)
 */
const jwt = require('jsonwebtoken');
const HttpError = require('../utils/HttpError');
const User = require('../models/user.model');

/** Verify the Bearer token and attach req.user = { id, name, role }. */
function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'No token provided — log in first.'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.sub, name: decoded.name, role: decoded.role };
    return next();
  } catch (err) {
    const msg =
      err.name === 'TokenExpiredError' ? 'Session expired — log in again.' : 'Invalid token.';
    return next(new HttpError(401, msg));
  }
}

/** Restrict a route to the given roles (e.g. clinical actions to doctor/admin). */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required.'));
    if (!roles.includes(req.user.role)) {
      return next(
        new HttpError(403, `Only ${roles.join(' or ')} accounts may perform this action.`)
      );
    }
    return next();
  };
}

/** Verify a still-active user exists (slow path used only by GET /auth/me). */
async function loadCurrentUser(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return User.findById(decoded.sub);
}

module.exports = { protect, authorize, loadCurrentUser };
