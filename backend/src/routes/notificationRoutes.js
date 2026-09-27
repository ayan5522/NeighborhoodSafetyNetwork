const express = require('express');
const notificationController = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// All notification routes require JWT authentication
router.use(requireAuth);

// 1. Retrieve User Notification Feed
router.get('/', (req, res, next) => notificationController.getNotifications(req, res, next));

// 2. Retrieve Unread Notification Count
router.get('/unread-count', (req, res, next) => notificationController.getUnreadCount(req, res, next));

// 3. Mark All Notifications as Read (declared before parameterized :id to avoid route shadowing)
router.patch('/read-all', (req, res, next) => notificationController.markAllAsRead(req, res, next));

// 4. Mark Single Notification as Read
router.patch('/:id/read', (req, res, next) => notificationController.markAsRead(req, res, next));

module.exports = router;
