const db = require('../config/db');
const logger = require('../utils/logger');

class EmergencyContactService {
  /**
   * Format contact object for safe client response
   */
  formatContact(row) {
    if (!row) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      phone_number: row.phone_number,
      relationship: row.relationship,
      is_primary: row.is_primary,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Add a new emergency contact for a user
   */
  async addEmergencyContact({ userId, name, phoneNumber, relationship = 'Emergency Contact', isPrimary = true }) {
    // If setting as primary, demote existing primary contacts
    if (isPrimary) {
      await db.query(
        `UPDATE emergency_contacts SET is_primary = false, updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );
    }

    const insertQuery = `
      INSERT INTO emergency_contacts (
        user_id,
        name,
        phone_number,
        relationship,
        is_primary
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      userId,
      name.trim(),
      phoneNumber.trim(),
      relationship ? relationship.trim() : 'Emergency Contact',
      isPrimary,
    ]);

    const created = result.rows[0];
    logger.info(`Emergency contact added: ${created.id} for user ${userId} (${name})`);

    return this.formatContact(created);
  }

  /**
   * Get all emergency contacts for a user
   */
  async getEmergencyContacts({ userId }) {
    const query = `
      SELECT *
      FROM emergency_contacts
      WHERE user_id = $1
      ORDER BY is_primary DESC, created_at DESC
    `;

    const result = await db.query(query, [userId]);
    return result.rows.map((r) => this.formatContact(r));
  }

  /**
   * Get primary emergency contact for user
   */
  async getPrimaryContact({ userId }) {
    const query = `
      SELECT *
      FROM emergency_contacts
      WHERE user_id = $1 AND is_primary = true
      LIMIT 1
    `;

    const result = await db.query(query, [userId]);
    if (result.rows.length === 0) return null;
    return this.formatContact(result.rows[0]);
  }

  /**
   * Delete an emergency contact (enforcing user ownership)
   */
  async deleteEmergencyContact({ contactId, userId }) {
    const checkQuery = `SELECT * FROM emergency_contacts WHERE id = $1`;
    const checkRes = await db.query(checkQuery, [contactId]);

    if (checkRes.rows.length === 0) {
      return null;
    }

    const contact = checkRes.rows[0];

    // Ownership check
    if (contact.user_id !== userId) {
      const error = new Error('You are not authorized to delete this emergency contact.');
      error.statusCode = 403;
      throw error;
    }

    await db.query(`DELETE FROM emergency_contacts WHERE id = $1`, [contactId]);
    logger.info(`Emergency contact deleted: ${contactId} by user ${userId}`);

    // If the deleted contact was primary, promote the most recent remaining contact
    if (contact.is_primary) {
      await db.query(`
        UPDATE emergency_contacts
        SET is_primary = true, updated_at = NOW()
        WHERE id = (
          SELECT id FROM emergency_contacts
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        )
      `, [userId]);
    }

    return true;
  }
}

module.exports = new EmergencyContactService();
