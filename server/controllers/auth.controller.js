/**
 * auth.controller.js — login and current-session endpoints.
 */
const jwt = require('jsonwebtoken');
const HttpError = require('../utils/HttpError');
const User = require('../models/user.model');
const { emitAudit } = require('../services/audit.service');

/** POST /api/auth/login  { email, password } → { token, user } */
async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    emitAudit({
      action: 'LOGIN_FAILED',
      entity: 'Auth',
      entityId: email,
      details: { reason: !user ? 'unknown_email' : 'bad_credentials' },
      ip: req.ip,
    });
    throw new HttpError(401, 'Invalid email or password.');
  }
  if (!user.isActive) throw new HttpError(403, 'This account is deactivated. Ask an admin.');

  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  emitAudit({
    actorId: user._id,
    actorRole: user.role,
    actorName: user.name,
    action: 'LOGIN_SUCCESS',
    entity: 'Auth',
    entityId: user._id.toString(),
    ip: req.ip,
  });

  res.json({
    success: true,
    message: `Welcome back, ${user.name}!`,
    token,
    user: user.toSafeJSON(),
  });
}

/** GET /api/auth/me → the logged-in user (fresh from the DB). */
async function me(req, res, next) {
  const user = await User.findById(req.user.id);
  if (!user) return next(new HttpError(401, 'Account no longer exists.'));
  res.json({ success: true, user: user.toSafeJSON() });
}

module.exports = { login, me };
