/**
 * export.routes.js — /api/export/backup (JSON) and /api/export/patients.csv.
 * Admin only: both files contain clinical data.
 */
const express = require('express');
const { exportBackup, exportPatientsCsv } = require('../controllers/export.controller');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect, authorize('admin'));

router.get('/backup', exportBackup);
router.get('/patients.csv', exportPatientsCsv);

module.exports = router;
