const express = require('express');
const sosController = require('../controllers/sosController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// All SOS routes require user authentication
router.use(requireAuth);

router.post('/', (req, res, next) => sosController.triggerSOS(req, res, next));
router.get('/my', (req, res, next) => sosController.getMySOSEvents(req, res, next));
router.patch('/:id/resolve', (req, res, next) => sosController.resolveSOS(req, res, next));

module.exports = router;
