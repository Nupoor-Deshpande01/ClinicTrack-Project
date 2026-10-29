/**
 * auth.routes.js — /api/auth
 */
const express = require('express');
const { login, me } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body } = require('express-validator');

const router = express.Router();

/**
 * Server-side login validation, independent from the React form's rules:
 * even a curl request with garbage is stopped here.
 */
router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('A valid email is required'),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ]),
  login
);

router.get('/me', protect, me);

module.exports = router;
