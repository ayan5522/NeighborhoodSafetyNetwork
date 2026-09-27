const { VALID_NOTIFICATION_TYPES } = require('../constants/notificationTypes');

/**
 * Validate UUID format (v4 or general UUID)
 */
const validateUUID = (id) => {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Validate query parameters for notification feed
 */
const validateNotificationFeedQuery = (query = {}) => {
  const errors = [];
  const { type, page, limit } = query;

  if (type && !VALID_NOTIFICATION_TYPES.includes(type.toUpperCase())) {
    errors.push(`Invalid notification type filter. Allowed values: ${VALID_NOTIFICATION_TYPES.join(', ')}`);
  }

  if (page !== undefined && (isNaN(parseInt(page, 10)) || parseInt(page, 10) < 1)) {
    errors.push('Page must be a positive integer starting from 1.');
  }

  if (limit !== undefined && (isNaN(parseInt(limit, 10)) || parseInt(limit, 10) < 1 || parseInt(limit, 10) > 100)) {
    errors.push('Limit must be an integer between 1 and 100.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate payload for internal notification creation
 */
const validateCreateNotificationPayload = (payload = {}) => {
  const errors = [];
  const { userId, type, title, message, incidentId, alertId } = payload;

  if (!userId || !validateUUID(userId)) {
    errors.push('userId is required and must be a valid UUID.');
  }

  if (!type || !VALID_NOTIFICATION_TYPES.includes(type)) {
    errors.push(`Invalid notification type. Allowed values: ${VALID_NOTIFICATION_TYPES.join(', ')}`);
  }

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Title is required and cannot be empty.');
  } else if (title.trim().length > 200) {
    errors.push('Title cannot exceed 200 characters.');
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    errors.push('Message is required and cannot be empty.');
  } else if (message.trim().length > 5000) {
    errors.push('Message cannot exceed 5000 characters.');
  }

  if (incidentId && !validateUUID(incidentId)) {
    errors.push('incidentId must be a valid UUID if provided.');
  }

  if (alertId && !validateUUID(alertId)) {
    errors.push('alertId must be a valid UUID if provided.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  validateUUID,
  validateNotificationFeedQuery,
  validateCreateNotificationPayload,
};
