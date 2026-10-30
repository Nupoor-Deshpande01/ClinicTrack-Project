/**
 * prescription.routes.js — /api/visits/:id/prescription and
 * /api/visits/:id/prescriptions. Mounted at /api/visits (patient-scoped
 * clinical data), so every route here is doctor/admin only.
 */
const express = require('express');
const { createPrescription, listForVisit } = require('../controllers/prescription.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body, param } = require('express-validator');

const router = express.Router();
router.use(protect, authorize('doctor', 'admin'));

const medicineRules = [
  body('medicines').isArray({ min: 1 }).withMessage('At least one medicine is required'),
  body('medicines.*.name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Medicine name: 2-80 chars'),
  body('medicines.*.dosage')
    .matches(/^\d+(\.\d+)?\s?(mg|ml|g|mcg|IU)$/i)
    .withMessage('Dosage like "500 mg"'),
  body('medicines.*.frequency')
    .isString()
    .trim()
    .isLength({ min: 1, max: 40 })
    .withMessage('Frequency required'),
  body('medicines.*.durationDays').isInt({ min: 1, max: 180 }).withMessage('Duration 1-180 days'),
  body('advice').optional().isString().isLength({ max: 500 }).withMessage('Advice max 500 chars'),
];

router.post(
  '/:id/prescription',
  validate([param('id').isMongoId(), ...medicineRules]),
  createPrescription
);
router.get('/:id/prescriptions', validate([param('id').isMongoId()]), listForVisit);

module.exports = router;
