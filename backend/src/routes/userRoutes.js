const express = require('express');
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { validateUpdateProfileInput } = require('../validators/authValidators');

const router = express.Router();

// Profile endpoints (Protected by JWT requireAuth)
router.get('/me', requireAuth, userController.getProfile);
router.patch('/me', requireAuth, validate(validateUpdateProfileInput), userController.updateProfile);

module.exports = router;
