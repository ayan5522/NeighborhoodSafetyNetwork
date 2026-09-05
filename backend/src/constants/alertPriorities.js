/**
 * Module 4: Alert Priority Constants
 * Derived from incident severity levels
 */
const ALERT_PRIORITIES = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
};

const VALID_ALERT_PRIORITIES = Object.values(ALERT_PRIORITIES);

module.exports = {
  ALERT_PRIORITIES,
  VALID_ALERT_PRIORITIES,
};
