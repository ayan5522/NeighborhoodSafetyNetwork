const db = require('../config/db');
const ALERT_CONFIG = require('../config/alertConfig');
const logger = require('../utils/logger');

class AlertService {
  /**
   * Determine rule parameters (priority, radius, expiry) from incident severity
   */
  getSeverityRule(severity) {
    const normSeverity = (severity || 'MEDIUM').toUpperCase();
    return ALERT_CONFIG.SEVERITY_RULES[normSeverity] || ALERT_CONFIG.SEVERITY_RULES.MEDIUM;
  }

  /**
   * Automatically generate alerts for nearby users when an incident is created
   * @param {Object} incident Incident object containing id, severity, latitude, longitude, reporter_id
   */
  async generateAlertsForIncident(incident) {
    const rule = this.getSeverityRule(incident.severity);
    const expiresAt = new Date(Date.now() + rule.expiryHours * 60 * 60 * 1000);

    try {
      // 1. Find all eligible nearby users with active locations within the configured radius
      // Using PostGIS ST_DWithin on user_locations and the incident coordinates
      const eligibleUsersQuery = `
        SELECT DISTINCT ul.user_id
        FROM user_locations ul
        JOIN users u ON u.id = ul.user_id
        WHERE u.status = 'ACTIVE'
          AND ST_DWithin(
            ul.geom,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3
          )
      `;

      const eligibleResult = await db.query(eligibleUsersQuery, [
        incident.longitude,
        incident.latitude,
        rule.radiusMeters,
      ]);

      const eligibleUsers = eligibleResult.rows;

      if (eligibleUsers.length === 0) {
        logger.info(`[Alert Generation] No eligible users within ${rule.radiusMeters}m for incident ${incident.id}`);
        return {
          generatedCount: 0,
          priority: rule.priority,
          radiusMeters: rule.radiusMeters,
          expiresAt,
        };
      }

      // 2. Batch insert alert records with unique constraint duplicate prevention
      let insertedCount = 0;
      for (const row of eligibleUsers) {
        const insertAlertQuery = `
          INSERT INTO alerts (
            incident_id,
            recipient_user_id,
            priority,
            status,
            expires_at
          ) VALUES ($1, $2, $3, 'ACTIVE', $4)
          ON CONFLICT (incident_id, recipient_user_id) DO NOTHING
          RETURNING id
        `;

        const res = await db.query(insertAlertQuery, [
          incident.id,
          row.user_id,
          rule.priority,
          expiresAt,
        ]);

        if (res.rowCount > 0) {
          insertedCount++;
        }
      }

      logger.info(
        `[Alert Generation] Generated ${insertedCount} alerts (priority: ${rule.priority}, radius: ${rule.radiusMeters}m) for incident ${incident.id}`
      );

      return {
        generatedCount: insertedCount,
        priority: rule.priority,
        radiusMeters: rule.radiusMeters,
        expiresAt,
      };
    } catch (err) {
      logger.error(`[Alert Generation Error] Failed for incident ${incident.id}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Lazily expire overdue active alerts for a user
   */
  async expireOverdueAlerts(userId) {
    try {
      await db.query(
        `UPDATE alerts 
         SET status = 'EXPIRED', updated_at = NOW() 
         WHERE recipient_user_id = $1 
           AND status = 'ACTIVE' 
           AND expires_at <= NOW()`,
        [userId]
      );
    } catch (err) {
      logger.warn(`[Alert Expiry] Failed lazy expiry check for user ${userId}: ${err.message}`);
    }
  }

  /**
   * Retrieve resident alert feed with privacy masking and approximate distance
   */
  async getUserAlertFeed({ userId, status, unreadOnly = false, page = 1, limit = 20 }) {
    // 1. Run lazy expiration update
    await this.expireOverdueAlerts(userId);

    const offset = (page - 1) * limit;
    const queryParams = [userId];
    let whereConditions = [`a.recipient_user_id = $1`];

    if (status) {
      queryParams.push(status.toUpperCase());
      whereConditions.push(`a.status = $${queryParams.length}`);
    }

    if (unreadOnly) {
      whereConditions.push(`a.read_at IS NULL`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Query alerts joined with incident details and user's registered location for distance
    const feedQuery = `
      SELECT 
        a.id AS alert_id,
        a.incident_id,
        a.priority,
        a.status,
        a.read_at,
        a.expires_at,
        a.created_at AS alert_created_at,
        i.category AS incident_category,
        i.title AS incident_title,
        i.description AS incident_description,
        i.severity AS incident_severity,
        i.image_url AS incident_image_url,
        i.neighborhood_name,
        i.locality,
        i.city,
        i.created_at AS incident_created_at,
        CASE 
          WHEN ul.geom IS NOT NULL AND i.geom IS NOT NULL THEN
            ROUND((ST_Distance(ul.geom, i.geom) / 50.0)) * 50
          ELSE NULL
        END AS approximate_distance_meters
      FROM alerts a
      JOIN incidents i ON i.id = a.incident_id
      LEFT JOIN user_locations ul ON ul.user_id = a.recipient_user_id
      WHERE ${whereClause}
      ORDER BY 
        CASE WHEN a.read_at IS NULL AND a.status = 'ACTIVE' THEN 0 ELSE 1 END,
        CASE a.priority
          WHEN 'URGENT' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'NORMAL' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END,
        a.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(feedQuery, queryParams);

    // Count total for pagination
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM alerts a
      WHERE ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      alerts: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single alert details (verifies user ownership and masks reporter identity)
   */
  async getAlertById({ alertId, userId }) {
    await this.expireOverdueAlerts(userId);

    const query = `
      SELECT 
        a.id AS alert_id,
        a.incident_id,
        a.recipient_user_id,
        a.priority,
        a.status,
        a.read_at,
        a.expires_at,
        a.resolved_at,
        a.created_at AS alert_created_at,
        i.category AS incident_category,
        i.title AS incident_title,
        i.description AS incident_description,
        i.severity AS incident_severity,
        i.image_url AS incident_image_url,
        i.neighborhood_name,
        i.locality,
        i.city,
        i.status AS incident_status,
        i.created_at AS incident_created_at,
        CASE 
          WHEN ul.geom IS NOT NULL AND i.geom IS NOT NULL THEN
            ROUND((ST_Distance(ul.geom, i.geom) / 50.0)) * 50
          ELSE NULL
        END AS approximate_distance_meters
      FROM alerts a
      JOIN incidents i ON i.id = a.incident_id
      LEFT JOIN user_locations ul ON ul.user_id = a.recipient_user_id
      WHERE a.id = $1
    `;

    const result = await db.query(query, [alertId]);

    if (result.rows.length === 0) {
      return null;
    }

    const alert = result.rows[0];

    // Ownership check
    if (alert.recipient_user_id !== userId) {
      const error = new Error('You are not authorized to view this private alert.');
      error.statusCode = 403;
      throw error;
    }

    return alert;
  }

  /**
   * Mark an alert as read by the recipient
   */
  async markAlertAsRead({ alertId, userId }) {
    const checkQuery = `SELECT id, recipient_user_id, read_at FROM alerts WHERE id = $1`;
    const checkResult = await db.query(checkQuery, [alertId]);

    if (checkResult.rows.length === 0) {
      return null;
    }

    const alert = checkResult.rows[0];

    if (alert.recipient_user_id !== userId) {
      const error = new Error('You are not authorized to modify this alert.');
      error.statusCode = 403;
      throw error;
    }

    if (alert.read_at) {
      return alert; // Already read
    }

    const updateQuery = `
      UPDATE alerts 
      SET read_at = NOW(), updated_at = NOW() 
      WHERE id = $1 
      RETURNING id, incident_id, priority, status, read_at, expires_at
    `;

    const updateResult = await db.query(updateQuery, [alertId]);
    return updateResult.rows[0];
  }

  /**
   * Get unread active alert count for badge display
   */
  async getUnreadAlertCount({ userId }) {
    await this.expireOverdueAlerts(userId);

    const countQuery = `
      SELECT COUNT(*) AS unread_count
      FROM alerts
      WHERE recipient_user_id = $1
        AND read_at IS NULL
        AND status = 'ACTIVE'
    `;

    const result = await db.query(countQuery, [userId]);
    return parseInt(result.rows[0].unread_count, 10);
  }

  /**
   * Resolve alerts when an incident is resolved or cancelled
   */
  async resolveAlertsForIncident({ incidentId }) {
    const updateQuery = `
      UPDATE alerts 
      SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW() 
      WHERE incident_id = $1 AND status = 'ACTIVE'
      RETURNING id
    `;
    const result = await db.query(updateQuery, [incidentId]);
    return result.rowCount;
  }
}

module.exports = new AlertService();
