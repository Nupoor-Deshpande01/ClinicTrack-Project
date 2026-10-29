/**
 * user.model.js — accounts for doctors, reception staff and admins.
 * Passwords are stored HASHED (bcrypt) and are never returned by queries —
 * note `select: false` below and the `toSafeJSON()` helper.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['doctor', 'staff', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // shape check; login flow does the real validation
    },
    // select:false → password field is excluded unless explicitly requested
    password: { type: String, required: true, select: false, minlength: 8 },
    role: { type: String, enum: ROLES, required: true }, // drives role-protected routes
    phone: { type: String, match: /^[6-9]\d{9}$/ },
    specialty: { type: String, trim: true }, // doctors only, e.g. "Cardiology"
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/** Hash the password once, just before saving a NEW or changed password. */
userSchema.pre('save', async function hashPassword(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

/** Everything except the password hash — use this on every API response. */
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone,
    specialty: this.specialty,
  };
};

module.exports = mongoose.model('User', userSchema);
