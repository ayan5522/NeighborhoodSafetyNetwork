const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const locationRoutes = require('./locationRoutes');
const devRoutes = require('./devRoutes');
const env = require('../config/env');

const router = express.Router();

// Mount Feature Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/location', locationRoutes);

// Development routes (enabled in non-production environments)
if (env.NODE_ENV !== 'production') {
  router.use('/dev', devRoutes);
}

// Health Check Endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Neighborhood Safety Network API is running.',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

module.exports = router;
