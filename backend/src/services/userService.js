const db = require('../config/db');
const authService = require('./authService');
const logger = require('../utils/logger');

class UserService {
  /**
   * Fetch current user profile.
   */
  async getProfile(userId) {
    const res = await db.query(
      `SELECT id, full_name, email, mobile_number, role, status, 
              email_verified, email_verified_at, mobile_verified, mobile_verified_at, 
              created_at, updated_at 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (res.rows.length === 0) {
      return { success: false, statusCode: 404, message: 'User not found.' };
    }

    return {
      success: true,
      statusCode: 200,
      message: 'User profile retrieved successfully.',
      data: {
        user: authService.sanitizeUser(res.rows[0]),
      },
    };
  }

  /**
   * Update allowed user profile fields (full_name).
   */
  async updateProfile(userId, { full_name }) {
    const res = await db.query(
      `UPDATE users 
       SET full_name = $1 
       WHERE id = $2 
       RETURNING id, full_name, email, mobile_number, role, status, 
                 email_verified, email_verified_at, mobile_verified, mobile_verified_at, 
                 created_at, updated_at`,
      [full_name, userId]
    );

    if (res.rows.length === 0) {
      return { success: false, statusCode: 404, message: 'User not found.' };
    }

    logger.info(`Profile updated for user: ${userId}`);

    return {
      success: true,
      statusCode: 200,
      message: 'Profile updated successfully.',
      data: {
        user: authService.sanitizeUser(res.rows[0]),
      },
    };
  }
}

module.exports = new UserService();
