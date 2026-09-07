const express = require('express');
const incidentController = require('../controllers/incidentController');
const verificationController = require('../controllers/verificationController');
const { requireAuth } = require('../middleware/authMiddleware');
const { handleIncidentImage } = require('../middleware/uploadMiddleware');
const validate = require('../middleware/validate');
const {
  validateCreateIncidentInput,
  validateUpdateIncidentInput,
  validateNearbyIncidentsQuery,
} = require('../validators/incidentValidators');
const {
  validateSubmitVerificationInput,
} = require('../validators/verificationValidators');

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
 * @route   GET /api/incidents/nearby
 * @desc    Get active nearby safety incidents within radius for Neighborhood Map display
 * @access  Private (Authenticated Users)
 */
router.get(
  '/nearby',
  validate(validateNearbyIncidentsQuery, 'query'),
  incidentController.getNearbyIncidents
);

/**
 * @route   GET /api/incidents/my
 * @desc    Get all incident reports submitted by current user
 * @access  Private (Authenticated Users)
 */
router.get('/my', incidentController.getMyIncidents);

/**
 * @route   POST /api/incidents/:id/verify
 * @desc    Submit verification (CONFIRM or DISPUTE) on an incident report
 * @access  Private (Authenticated Users)
 */
router.post(
  '/:id/verify',
  validate(validateSubmitVerificationInput, 'body'),
  verificationController.submitVerification
);

/**
 * @route   GET /api/incidents/:id/verifications
 * @desc    Get verification summary and status for an incident report
 * @access  Private (Authenticated Users)
 */
router.get('/:id/verifications', verificationController.getIncidentVerifications);

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
