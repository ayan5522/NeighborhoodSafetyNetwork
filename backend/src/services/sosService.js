const db = require('../config/db');
const { SOS_STATUS } = require('../constants/sosStatus');
const emergencyContactService = require('./emergencyContactService');
const emergencyNotificationService = require('./emergencyNotificationService');
const logger = require('../utils/logger');

class SOSService {
  /**
   * Format SOS event object for safe client response
   */
  formatSOSEvent(row) {
    if (!row) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      neighborhood_name: row.neighborhood_name || null,
      locality: row.locality || null,
      city: row.city || null,
      status: row.status,
      contact_notified: row.contact_notified || false,
      created_at: row.created_at,
      resolved_at: row.resolved_at || null,
    };
  }

  /**
   * Trigger a Personal Emergency SOS event for authenticated user
   */
  async triggerSOS({ userId, latitude, longitude, notifyContact = false }) {
    const lat = Number(latitude);
    const lon = Number(longitude);

    // Fetch user details for notification
    const userRes = await db.query('SELECT full_name, email, mobile_number FROM users WHERE id = $1::uuid', [userId]);
    const user = userRes.rows[0] || {};

    // Get approximate area info if available
    let areaInfo = { neighborhood_name: 'Local Area', locality: 'City Zone', city: 'Ratnagiri' };
    try {
      const locRes = await db.query(
        'SELECT neighborhood_name, locality, city FROM user_locations WHERE user_id = $1::uuid',
        [userId]
      );
      if (locRes.rows.length > 0) {
        areaInfo = locRes.rows[0];
      }
    } catch (e) {}

    const insertQuery = `
      INSERT INTO sos_events (
        user_id,
        latitude,
        longitude,
        geom,
        neighborhood_name,
        locality,
        city,
        status,
        contact_notified
      ) VALUES (
        $1::uuid,
        $2::numeric,
        $3::numeric,
        ST_SetSRID(ST_MakePoint($3::double precision, $2::double precision), 4326)::geography,
        $4,
        $5,
        $6,
        'ACTIVE',
        $7::boolean
      )
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      userId,
      lat,
      lon,
      areaInfo.neighborhood_name,
      areaInfo.locality,
      areaInfo.city,
      notifyContact,
    ]);

    const createdEvent = result.rows[0];
    logger.info(`Personal SOS triggered: ${createdEvent.id} by user ${userId} at [${lat}, ${lon}]`);

    let notificationResult = null;

    // Notify primary emergency contact if requested
    if (notifyContact) {
      const primaryContact = await emergencyContactService.getPrimaryContact({ userId });
      if (primaryContact) {
        notificationResult = await emergencyNotificationService.notifyEmergencyContact({
          contactName: primaryContact.name,
          phoneNumber: primaryContact.phone_number,
          userFullName: user.full_name,
          locationText: `${areaInfo.neighborhood_name || 'Neighborhood'}, ${areaInfo.locality || 'Locality'}`,
          coordinates: { latitude: lat, longitude: lon },
          eventType: 'PERSONAL_SOS',
        });
      }
    }

    return {
      sosEvent: this.formatSOSEvent(createdEvent),
      contactNotification: notificationResult,
    };
  }

  /**
   * Get user's active and historical SOS events
   */
  async getMySOSEvents({ userId, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;

    const query = `
      SELECT *
      FROM sos_events
      WHERE user_id = $1::uuid
      ORDER BY 
        CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
        created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [userId, limit, offset]);

    const countRes = await db.query(`SELECT COUNT(*) AS total FROM sos_events WHERE user_id = $1::uuid`, [userId]);
    const total = parseInt(countRes.rows[0].total, 10);

    return {
      events: result.rows.map((r) => this.formatSOSEvent(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Resolve or cancel an active SOS event
   */
  async resolveSOS({ sosId, userId, action = 'RESOLVE' }) {
    const checkQuery = `SELECT * FROM sos_events WHERE id = $1::uuid`;
    const checkRes = await db.query(checkQuery, [sosId]);

    if (checkRes.rows.length === 0) {
      return null;
    }

    const event = checkRes.rows[0];

    // Ownership check
    if (event.user_id !== userId) {
      const error = new Error('You are not authorized to modify this SOS event.');
      error.statusCode = 403;
      throw error;
    }

    const targetStatus = action === 'CANCEL' ? SOS_STATUS.CANCELLED : SOS_STATUS.RESOLVED;

    const updateQuery = `
      UPDATE sos_events
      SET status = $1, resolved_at = NOW()
      WHERE id = $2::uuid
      RETURNING *
    `;

    const updateRes = await db.query(updateQuery, [targetStatus, sosId]);
    logger.info(`SOS event ${sosId} transitioned to ${targetStatus} by user ${userId}`);

    return this.formatSOSEvent(updateRes.rows[0]);
  }
}

module.exports = new SOSService();
