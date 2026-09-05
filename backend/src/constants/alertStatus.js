/**
 * Module 4: Alert Lifecycle Status Constants
 */
const ALERT_STATUS = {
  ACTIVE: 'ACTIVE',
  RESOLVED: 'RESOLVED',
  EXPIRED: 'EXPIRED',
};

const VALID_ALERT_STATUSES = Object.values(ALERT_STATUS);

module.exports = {
  ALERT_STATUS,
  VALID_ALERT_STATUSES,
};
