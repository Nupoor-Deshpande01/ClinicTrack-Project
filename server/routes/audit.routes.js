/**
 * audit.routes.js — /api/audit and /api/audit/verify (doctor + admin).
 * Reception cannot read the trail: entries describe clinical work.
 */
const express = require('express');
const { listAudit, verifyAudit } = require('../controllers/audit.controller');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect, authorize('doctor', 'admin'));

router.get('/', listAudit);
router.get('/verify', verifyAudit);

module.exports = router;
