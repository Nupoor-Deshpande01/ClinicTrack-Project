/**
 * user.controller.js — doctor directories + admin user management.
 */
const HttpError = require('../utils/HttpError');
const User = require('../models/user.model');
const { emitAudit } = require('../services/audit.service');

/** GET /api/users?role=doctor → directory (any logged-in user needs doctors for pickers). */
async function listUsers(req, res) {
  const isAdmin = req.user.role === 'admin';
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  // Non-admins may only look at doctors (for assignment dropdowns).
  if (!isAdmin) {
    if (filter.role && filter.role !== 'doctor') {
      throw new HttpError(403, 'Only admins can browse staff accounts.');
    }
    filter.role = 'doctor';
  }

  const users = await User.find(filter)
    .sort({ name: 1 })
    .select('name email role specialty phone isActive');
  res.json({
    success: true,
    data: users.map(u => ({
      id: u._id,
      name: u.name,
      email: isAdmin ? u.email : undefined,
      role: u.role,
      specialty: u.specialty,
      phone: u.phone,
      isActive: u.isActive,
    })),
  });
}

/** POST /api/users (admin) — create a doctor/staff/admin account. */
async function createUser(req, res) {
  const { name, email, password, role, specialty, phone } = req.body;
  const exists = await User.findOne({ email });
  if (exists) throw new HttpError(409, 'An account with this email already exists.');

  const user = await User.create({ name, email, password, role, specialty, phone });
  emitAudit({
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.name,
    action: 'USER_CREATED',
    entity: 'User',
    entityId: user._id.toString(),
    details: { email: user.email, role: user.role },
  });
  res
    .status(201)
    .json({ success: true, message: `Account created for ${user.name}.`, data: user.toSafeJSON() });
}

module.exports = { listUsers, createUser };
