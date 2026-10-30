/**
 * analytics.routes.js — /api/analytics
 */
const express = require('express');
const { summary } = require('../controllers/analytics.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/summary', summary);

module.exports = router;
