/**
 * queue.routes.js — /api/queue
 * All roles may see the queue (reception runs it, doctors call tokens);
 * only an admin can no longer change statuses once a token is closed — the
 * state enum itself is the guard.
 */
const express = require('express');
const { body, param } = require('express-validator');
const { getQueue, addToken, updateToken } = require('../controllers/queue.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.get('/', getQueue);

router.post(
  '/',
  validate([
    body('patientId').isMongoId().withMessage('Choose a patient'),
    body('doctorId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid doctor'),
    body('note').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  ]),
  addToken
);

router.patch(
  '/:id',
  validate([
    param('id').isMongoId(),
    body('status')
      .isIn(['waiting', 'serving', 'done', 'skipped'])
      .withMessage('status must be waiting, serving, done or skipped'),
  ]),
  updateToken
);

module.exports = router;
