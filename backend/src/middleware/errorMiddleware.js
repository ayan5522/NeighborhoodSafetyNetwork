const { apiError } = require('../utils/response');
const logger = require('../utils/logger');
const env = require('../config/env');

/**
 * 404 Not Found Middleware
 */
function notFoundHandler(req, res) {
  return apiError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

/**
 * Global Error Handling Middleware
 */
function globalErrorHandler(err, req, res, next) {
  logger.error(`Unhandled server error on [${req.method}] ${req.originalUrl}:`, err);

  // PostgreSQL unique violation error code
  if (err.code === '23505') {
    if (err.detail && err.detail.includes('email')) {
      return apiError(res, 409, 'An account with this email address already exists.');
    }
    if (err.detail && err.detail.includes('mobile_number')) {
      return apiError(res, 409, 'An account with this mobile number already exists.');
    }
    return apiError(res, 409, 'A resource with this identifier already exists.');
  }

  // Syntax error / JSON parse error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return apiError(res, 400, 'Malformed JSON payload in request body.');
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode < 500 || env.NODE_ENV === 'development'
    ? err.message
    : 'An unexpected internal server error occurred.';

  return apiError(res, statusCode, message);
}

module.exports = {
  notFoundHandler,
  globalErrorHandler,
};
