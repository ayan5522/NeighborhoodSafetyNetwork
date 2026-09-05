const express = require('express');
const incidentController = require('../controllers/incidentController');
const { requireAuth } = require('../middleware/authMiddleware');
const { handleIncidentImage } = require('../middleware/uploadMiddleware');
const validate = require('../middleware/validate');
const {
  validateCreateIncidentInput,
  validateUpdateIncidentInput,
} = require('../validators/incidentValidators');

const router = express.Router();

// All incident endpoints require authenticated user session
router.use(requireAuth);

/**
 * @route   POST /api/incidents
 * @desc    Report a new safety incident (supports JSON and multipart/form-data with optional image)
 * @access  Private (Authenticated Users)
 */
router.post(
  '/',
  handleIncidentImage,
  validate(validateCreateIncidentInput, 'body'),
  incidentController.createIncident
);

/**
 * @route   GET /api/incidents/my
 * @desc    Get all incident reports submitted by current user
 * @access  Private (Authenticated Users)
 */
router.get('/my', incidentController.getMyIncidents);

/**
 * @route   GET /api/incidents/:id
 * @desc    Get specific incident details (strictly owned by current user for Module 3)
 * @access  Private (Authenticated Users)
 */
router.get('/:id', incidentController.getIncidentById);

/**
 * @route   PATCH /api/incidents/:id
 * @desc    Update pending incident report
 * @access  Private (Authenticated Users)
 */
router.patch(
  '/:id',
  validate(validateUpdateIncidentInput, 'body'),
  incidentController.updateIncident
);

/**
 * @route   PATCH /api/incidents/:id/cancel
 * @desc    Cancel an incident report
 * @access  Private (Authenticated Users)
 */
router.patch('/:id/cancel', incidentController.cancelIncident);

module.exports = router;
