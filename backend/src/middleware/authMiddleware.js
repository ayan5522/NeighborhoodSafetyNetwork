const { verifyToken } = require('../utils/cryptoUtils');
const { apiError } = require('../utils/response');
const db = require('../config/db');
const { USER_STATUS } = require('../constants/userStatus');

/**
 * Middleware to authenticate requests via JWT Bearer token.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return apiError(res, 401, 'Authentication token is required. Please log in.');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return apiError(res, 401, 'Session has expired. Please log in again.');
      }
      return apiError(res, 401, 'Invalid authentication token.');
    }

    // Verify user exists and is ACTIVE
    const query = `
      SELECT id, full_name, email, mobile_number, role, status, email_verified, mobile_verified, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    const result = await db.query(query, [decoded.id]);

    if (result.rows.length === 0) {
      return apiError(res, 401, 'User account not found.');
    }

    const user = result.rows[0];

    if (user.status !== USER_STATUS.ACTIVE) {
      return apiError(res, 401, 'User account is not active. Please complete verification or contact support.');
    }

    req.user = user;
    next();
  } catch (error) {
    return apiError(res, 500, 'Authentication error.', [error.message]);
  }
}

/**
 * Middleware to restrict access based on user roles.
 * @param  {...string} allowedRoles - Allowed roles (e.g. 'admin', 'moderator')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return apiError(res, 401, 'Authentication required.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return apiError(res, 403, `Access forbidden. Required role: ${allowedRoles.join(' or ')}.`);
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
