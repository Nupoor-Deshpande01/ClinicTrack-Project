/**
 * patient.routes.js — /api/patients
 */
const express = require('express');
const {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
} = require('../controllers/patient.controller');
const { createVisit, listVisits } = require('../controllers/visit.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body, param, query } = require('express-validator');

const router = express.Router();
router.use(protect); // every patient route needs a valid JWT

const patientRules = [
  body('fullName')
    .matches(/^[A-Za-z][A-Za-z .-]{1,58}$/)
    .withMessage('Name must be letters, spaces, dots or hyphens'),
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Indian mobile: 10 digits starting with 6-9'),
  body('dob')
    .isISO8601()
    .withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
    .custom(v => new Date(v) < new Date())
    .withMessage('DOB cannot be in the future'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('gender must be male/female/other'),
  body('allergies').optional().isArray().withMessage('allergies must be an array of strings'),
  body('allergies.*')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Allergy names max 60 chars'),
  body('treatment')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Treatment description max 300 characters'),
  body('primaryDoctorId').optional().isMongoId().withMessage('Invalid doctor id'),
  body('addToSchedule').optional().isBoolean(),
];

router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1-50'),
  ]),
  listPatients
);

// Registration is desk work — staff may register; clinical edits are not.
router.post('/', authorize('doctor', 'staff', 'admin'), validate(patientRules), createPatient);

router.get('/:id', getPatient);

router.put(
  '/:id',
  authorize('doctor', 'admin'),
  validate(
    patientRules.map(r => r) // same shape rules on update (required fields stay present in the body)
  ),
  updatePatient
);

// ---- clinical records: doctor/admin only (reception must not see notes) ----
const visitRules = [
  body('visitDate')
    .isISO8601()
    .withMessage('visitDate must be a valid date (YYYY-MM-DD)')
    .custom(v => new Date(v) <= new Date(Date.now() + 12 * 3600 * 1000))
    .withMessage('visitDate cannot be in the future'),
  body('diagnosis')
    .isString()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Diagnosis: 2-200 characters'),
  body('symptoms').optional().isArray().withMessage('symptoms must be an array'),
  body('notes').optional().isString().isLength({ max: 4000 }).withMessage('notes max 4000 chars'),
  body('vitals.temperatureC')
    .optional()
    .isFloat({ min: 30, max: 45 })
    .withMessage('temperature 30-45°C'),
  body('vitals.bloodPressure')
    .optional()
    .matches(/^\d{2,3}\/\d{2,3}$/)
    .withMessage('bloodPressure like 120/80'),
  body('vitals.heartRate')
    .optional()
    .isInt({ min: 25, max: 250 })
    .withMessage('heartRate 25-250 bpm'),
];

router.post(
  '/:id/visits',
  authorize('doctor', 'admin'),
  validate([param('id').isMongoId().withMessage('Invalid patient id'), ...visitRules]),
  createVisit
);
router.get(
  '/:id/visits',
  authorize('doctor', 'admin'),
  validate([param('id').isMongoId().withMessage('Invalid patient id')]),
  listVisits
);

module.exports = router;
