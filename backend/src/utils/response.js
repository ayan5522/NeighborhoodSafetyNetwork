/**
 * Standardized API Response Builders
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {object|null} data
 */
function apiSuccess(res, statusCode = 200, message = 'Success', data = null) {
  const responseBody = {
    success: true,
    message,
  };

  if (data !== null && data !== undefined) {
    responseBody.data = data;
  }

  return res.status(statusCode).json(responseBody);
}

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {Array} errors
 */
function apiError(res, statusCode = 500, message = 'An unexpected error occurred', errors = []) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors: Array.isArray(errors) ? errors : [errors],
  });
}

module.exports = {
  apiSuccess,
  apiError,
};
