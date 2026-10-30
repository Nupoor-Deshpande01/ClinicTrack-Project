/**
 * prescription.routes.js — two routers in one file because they share the
 * same validation rules:
 *
 *  visitsRouter        → /api/visits/:id/prescription(s)   (clinical roles)
 *  prescriptionsRouter → /api/prescriptions                (PDF + list, clinical roles)
 *                        /api/prescriptions/verify/:qrToken (PUBLIC — QR scan)
 */
const express = require('express');
const { body, param } = require('express-validator');
const {
  createPrescription,
  listForVisit,
  listRecent,
  prescriptionPdf,
  verifyPrescription,
} = require('../controllers/prescription.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

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

// ---- /api/visits/:id/prescription(s) ----
const visitsRouter = express.Router();
visitsRouter.use(protect, authorize('doctor', 'admin'));

visitsRouter.post(
  '/:id/prescription',
  validate([param('id').isMongoId(), ...medicineRules]),
  createPrescription
);
visitsRouter.get('/:id/prescriptions', validate([param('id').isMongoId()]), listForVisit);

// ---- /api/prescriptions ----
const prescriptionsRouter = express.Router();

// Public: the QR code on every printed prescription points here.
prescriptionsRouter.get(
  '/verify/:qrToken',
  validate([param('qrToken').isLength({ min: 16, max: 64 })]),
  verifyPrescription
);

prescriptionsRouter.get('/', protect, authorize('doctor', 'admin'), listRecent);
prescriptionsRouter.get(
  '/:id/pdf',
  protect,
  authorize('doctor', 'admin'),
  validate([param('id').isMongoId()]),
  prescriptionPdf
);

module.exports = visitsRouter;
module.exports.prescriptions = prescriptionsRouter;
