/**
 * Module 4: Alert Targeting, Radius & Expiry Configuration
 * Centralized, configurable rules for emergency alert generation
 */
const ALERT_CONFIG = {
  // Severity to Alert Priority, Radius (meters), and Expiry duration (hours)
  SEVERITY_RULES: {
    LOW: {
      priority: 'LOW',
      radiusMeters: 1000, // 1 km
      expiryHours: 6,
      emergencyAssistanceAvailable: false,
    },
    MEDIUM: {
      priority: 'NORMAL',
      radiusMeters: 2000, // 2 km
      expiryHours: 6,
      emergencyAssistanceAvailable: false,
    },
    HIGH: {
      priority: 'HIGH',
      radiusMeters: 3000, // 3 km
      expiryHours: 3,
      emergencyAssistanceAvailable: true,
    },
    CRITICAL: {
      priority: 'URGENT',
      radiusMeters: 5000, // 5 km
      expiryHours: 1,
      emergencyAssistanceAvailable: true,
    },
  },

  // National emergency dispatch contact (India)
  EMERGENCY_SERVICES: {
    NATIONAL_NUMBER: '112',
    COUNTRY_CODE: 'IN',
  },

  // Default pagination limits
  DEFAULT_FEED_LIMIT: 20,
  MAX_FEED_LIMIT: 50,
};

module.exports = ALERT_CONFIG;
