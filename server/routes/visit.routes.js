/**
 * visit.routes.js — /api/visits/*.
 * Clinical records are doctor/admin territory: reception must never see
 * clinical notes or prescriptions, so ALL visit routes are role-guarded.
 * (Patient-scoped visit routes live in patient.routes.js under
 *  /api/patients/:id/visits, where they belong by resource.)
 */
const express = require('express');
const {
  updateVisit,
  listVersions,
  diffVisits,
  rollbackVisit,
} = require('../controllers/visit.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body, param } = require('express-validator');

const router = express.Router();
router.use(protect, authorize('doctor', 'admin'));

// "Creating a new version" must say WHAT and WHY it changed.
const changeRules = [
  body('changeReason')
    .isString()
    .trim()
    .isLength({ min: 4, max: 300 })
    .withMessage('changeReason: 4-300 chars'),
];

router.put(
  '/:id',
  validate([param('id').isMongoId().withMessage('Invalid visit id'), ...changeRules]),
  updateVisit
);
router.get(
  '/:id/versions',
  validate([param('id').isMongoId().withMessage('Invalid visit id')]),
  listVersions
);
router.post(
  '/:id/rollback',
  validate([
    param('id').isMongoId().withMessage('Invalid visit id'),
    body('targetVisitId').isMongoId().withMessage('targetVisitId must be a Mongo id'),
  ]),
  rollbackVisit
);
router.get('/:a/diff/:b', validate([param('a').isMongoId(), param('b').isMongoId()]), diffVisits);

module.exports = router;
