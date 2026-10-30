/**
 * appointment.routes.js — /api/appointments
 */
const express = require('express');
const {
  listAppointments,
  createAppointment,
  deleteAppointment,
} = require('../controllers/appointment.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body, param } = require('express-validator');

const router = express.Router();
router.use(protect);

router.get('/', listAppointments);
router.post(
  '/',
  authorize('doctor', 'staff', 'admin'),
  validate([
    body('patientId').isMongoId().withMessage('patientId must be a Mongo id'),
    body('doctorId').isMongoId().withMessage('doctorId must be a Mongo id'),
    body('scheduledAt')
      .isISO8601()
      .withMessage('scheduledAt must be an ISO date')
      .custom(v => new Date(v) >= new Date(Date.now() - 3600 * 1000))
      .withMessage('Appointment cannot be scheduled in the past'),
    body('disease').optional().isString().isLength({ max: 120 }),
  ]),
  createAppointment
);
router.delete(
  '/:id',
  authorize('doctor', 'staff', 'admin'),
  validate([param('id').isMongoId()]),
  deleteAppointment
);

module.exports = router;
