const express = require('express');
const emergencyContactController = require('../controllers/emergencyContactController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// All emergency contact routes require user authentication
router.use(requireAuth);

router.post('/', (req, res, next) => emergencyContactController.addContact(req, res, next));
router.get('/', (req, res, next) => emergencyContactController.getContacts(req, res, next));
router.delete('/:id', (req, res, next) => emergencyContactController.deleteContact(req, res, next));

module.exports = router;
