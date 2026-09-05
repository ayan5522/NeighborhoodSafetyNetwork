const express = require('express');
const alertController = require('../controllers/alertController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// All alert routes require user authentication
router.use(requireAuth);

// Resident Alert Feed & Badges
router.get('/', (req, res, next) => alertController.getAlerts(req, res, next));
router.get('/unread-count', (req, res, next) => alertController.getUnreadCount(req, res, next));
router.get('/:id', (req, res, next) => alertController.getAlertById(req, res, next));
router.patch('/:id/read', (req, res, next) => alertController.markRead(req, res, next));

module.exports = router;
