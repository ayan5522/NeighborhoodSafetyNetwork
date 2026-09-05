/**
 * Middleware factory for Role-Based Access Control
 * @param  {...string} allowedRoles
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden. Requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

module.exports = { requireRole };
