const express = require('express');
const devController = require('../controllers/devController');

const router = express.Router();

// Development inspection endpoint (only active when NODE_ENV !== 'production')
router.get('/otps', devController.getDevOTPs);

module.exports = router;
