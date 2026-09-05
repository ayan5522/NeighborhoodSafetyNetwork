const { VALID_ALERT_STATUSES } = require('../constants/alertStatus');

/**
 * Validate query parameters for alert feed
 */
const validateAlertFeedQuery = (query) => {
  const errors = [];
  const { status, unread_only, page, limit } = query;

  if (status && !VALID_ALERT_STATUSES.includes(status.toUpperCase())) {
    errors.push(`Invalid status filter. Allowed values: ${VALID_ALERT_STATUSES.join(', ')}`);
  }

  if (page && (isNaN(parseInt(page, 10)) || parseInt(page, 10) < 1)) {
    errors.push('Page must be a positive integer starting from 1.');
  }

  if (limit && (isNaN(parseInt(limit, 10)) || parseInt(limit, 10) < 1 || parseInt(limit, 10) > 100)) {
    errors.push('Limit must be an integer between 1 and 100.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate UUID format
 */
const validateUUID = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

module.exports = {
  validateAlertFeedQuery,
  validateUUID,
};
