/**
 * user.routes.js — /api/users
 */
const express = require('express');
const { listUsers, createUser } = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body } = require('express-validator');

const router = express.Router();
router.use(protect);

router.get('/', listUsers);
router.post(
  '/',
  authorize('admin'),
  validate([
    body('name')
      .matches(/^[A-Za-z][A-Za-z .-]{1,58}$/)
      .withMessage('Name must be letters and spaces'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role')
      .isIn(['doctor', 'staff', 'admin'])
      .withMessage('role must be doctor, staff or admin'),
    body('specialty').optional().isString().isLength({ max: 60 }),
    body('phone')
      .optional()
      .matches(/^[6-9]\d{9}$/)
      .withMessage('Indian mobile: 10 digits starting 6-9'),
  ]),
  createUser
);

module.exports = router;
