const express = require('express');
const locationController = require('../controllers/locationController');
const { requireAuth } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const {
  validateUpdateLocationInput,
  validateNearbyQuery,
  validateNeighborhoodQuery,
} = require('../validators/locationValidators');

const router = express.Router();

// All location endpoints require authenticated resident session
router.use(requireAuth);

/**
 * @route   POST /api/location
 * @desc    Save/update authenticated user's current GPS location
 * @access  Private (Authenticated Users)
 */
router.post('/', validate(validateUpdateLocationInput, 'body'), locationController.updateLocation);

/**
 * @route   GET /api/location/me
 * @desc    Get authenticated user's latest stored location
 * @access  Private (Authenticated Users)
 */
router.get('/me', locationController.getMyLocation);

/**
 * @route   GET /api/location/nearby
 * @desc    Get nearby safety circle & active residents within configurable radius (PostGIS ST_DWithin)
 * @access  Private (Authenticated Users, Privacy-Preserving)
 */
router.get('/nearby', validate(validateNearbyQuery, 'query'), locationController.getNearby);

/**
 * @route   GET /api/location/neighborhood
 * @desc    Get approximate neighborhood/locality info for current position
 * @access  Private (Authenticated Users)
 */
router.get('/neighborhood', validate(validateNeighborhoodQuery, 'query'), locationController.getNeighborhood);

module.exports = router;
