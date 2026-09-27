const db = require('../config/db');
const ALERT_CONFIG = require('../config/alertConfig');
const logger = require('../utils/logger');
const { validateCreateNotificationPayload, validateUUID } = require('../validators/notificationValidators');

class NotificationService {
  /**
   * Format database notification row into a clean, safe client response.
   * Ensures no sensitive internal fields or private data are leaked.
   */
  formatNotification(row) {
    if (!row) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      incident_id: row.incident_id || null,
      alert_id: row.alert_id || null,
      is_read: Boolean(row.is_read),
      created_at: row.created_at,
      read_at: row.read_at || null,
    };
  }

  /**
   * Internal Service Method: Create and store a new notification for a specific user.
   * Used exclusively by trusted backend modules (Incidents, Alerts, Verification, SOS).
   */
  async createNotification({ userId, type, title, message, incidentId = null, alertId = null }) {
    const payload = {
      userId,
      type: type ? String(type).trim().toUpperCase() : type,
      title: title ? String(title).trim() : title,
      message: message ? String(message).trim() : message,
      incidentId: incidentId || null,
      alertId: alertId || null,
    };

    const validation = validateCreateNotificationPayload(payload);
    if (!validation.isValid) {
      const error = new Error(`Notification validation failed: ${validation.errors.join(' ')}`);
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const query = `
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        incident_id,
        alert_id,
        is_read,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
      RETURNING *
    `;

    const values = [
      payload.userId,
      payload.type,
      payload.title,
      payload.message,
      payload.incidentId,
      payload.alertId,
    ];

    const result = await db.query(query, values);
    const createdNotification = this.formatNotification(result.rows[0]);

    logger.info(`[NotificationService] Created ${payload.type} notification for user ${payload.userId} (ID: ${createdNotification.id})`);

    return createdNotification;
  }

  /**
   * Automatically generate INCIDENT_NEARBY notifications for eligible nearby residents
   * when a new safety incident is reported.
   * - Uses PostGIS ST_DWithin on user_locations and the incident coordinates
   * - Reuses severity -> radius configuration from ALERT_CONFIG
   * - Strictly excludes the incident reporter (ul.user_id != incident.reporter_id)
   * - Links alert_id if an alert was generated for this recipient
   * - Prevents duplicates via PostgreSQL partial unique index
   * - Never exposes private user or reporter data
   * @param {Object} incident Incident row object containing id, category, title, severity, latitude, longitude, reporter_id
   */
  async generateIncidentNearbyNotifications(incident) {
    if (!incident || !incident.id || incident.latitude === undefined || incident.longitude === undefined) {
      return { generatedCount: 0, radiusMeters: 0, recipientUserIds: [] };
    }

    const normSeverity = (incident.severity || 'MEDIUM').toUpperCase();
    const severityRule = ALERT_CONFIG.SEVERITY_RULES[normSeverity] || ALERT_CONFIG.SEVERITY_RULES.MEDIUM;
    const radiusMeters = severityRule.radiusMeters || 2000;

    const formattedCategory = incident.category ? incident.category.replace(/_/g, ' ') : 'Safety';
    const title = `Nearby Safety Incident: ${incident.category}`;
    const radiusLabel = radiusMeters >= 1000 ? `${radiusMeters / 1000} km` : `${radiusMeters}m`;
    const message = `A ${formattedCategory} incident ("${incident.title}") has been reported within ${radiusLabel} of your location.`;

    try {
      const insertQuery = `
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          incident_id,
          alert_id,
          is_read,
          created_at
        )
        SELECT 
          ul.user_id,
          'INCIDENT_NEARBY',
          $1,
          $2,
          $3::uuid,
          a.id,
          false,
          NOW()
        FROM user_locations ul
        JOIN users u ON u.id = ul.user_id
        LEFT JOIN alerts a ON a.incident_id = $3::uuid AND a.recipient_user_id = ul.user_id
        WHERE u.status = 'ACTIVE'
          AND ul.user_id != $4::uuid
          AND ST_DWithin(
            ul.geom,
            ST_SetSRID(ST_MakePoint($5::double precision, $6::double precision), 4326)::geography,
            $7::double precision
          )
        ON CONFLICT (user_id, incident_id, type) WHERE incident_id IS NOT NULL DO NOTHING
        RETURNING id, user_id
      `;

      const values = [
        title,
        message,
        incident.id,
        incident.reporter_id,
        parseFloat(incident.longitude),
        parseFloat(incident.latitude),
        parseFloat(radiusMeters),
      ];

      const result = await db.query(insertQuery, values);
      const insertedCount = result.rowCount;

      logger.info(
        `[NotificationService] Generated ${insertedCount} INCIDENT_NEARBY notifications (radius: ${radiusMeters}m) for incident ${incident.id}`
      );

      return {
        generatedCount: insertedCount,
        radiusMeters,
        recipientUserIds: result.rows.map((r) => r.user_id),
      };
    } catch (err) {
      logger.error(`[NotificationService] Error generating nearby notifications for incident ${incident.id}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Retrieve notification feed belonging strictly to the authenticated user.
   * Supports pagination, unread filter, and type filter. Sorted newest first.
   */
  async getUserNotifications({ userId, type = null, unreadOnly = false, page = 1, limit = 20 }) {
    if (!validateUUID(userId)) {
      const error = new Error('Invalid user ID.');
      error.statusCode = 400;
      throw error;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = ['user_id = $1'];
    const queryParams = [userId];

    if (unreadOnly) {
      whereClauses.push('is_read = false');
    }

    if (type) {
      queryParams.push(type.toUpperCase());
      whereClauses.push(`type = $${queryParams.length}`);
    }

    // 1. Total count for pagination metadata
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM notifications
      WHERE ${whereClauses.join(' AND ')}
    `;
    const countRes = await db.query(countQuery, queryParams);
    const totalCount = parseInt(countRes.rows[0].total, 10) || 0;

    // 2. Fetch paginated notifications
    const dataQueryParams = [...queryParams, limitNum, offset];
    const dataQuery = `
      SELECT *
      FROM notifications
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${dataQueryParams.length - 1}
      OFFSET $${dataQueryParams.length}
    `;

    const result = await db.query(dataQuery, dataQueryParams);

    return {
      notifications: result.rows.map((row) => this.formatNotification(row)),
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(totalCount / limitNum) || 1,
      },
    };
  }

  /**
   * Get the number of unread notifications for a specific user.
   */
  async getUnreadNotificationCount({ userId }) {
    if (!validateUUID(userId)) {
      const error = new Error('Invalid user ID.');
      error.statusCode = 400;
      throw error;
    }

    const query = `
      SELECT COUNT(*) AS count
      FROM notifications
      WHERE user_id = $1 AND is_read = false
    `;
    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].count, 10) || 0;
  }

  /**
   * Mark a single notification as read. Idempotent and strictly scoped to owner.
   */
  async markNotificationAsRead({ notificationId, userId }) {
    if (!validateUUID(notificationId) || !validateUUID(userId)) {
      return null;
    }

    const query = `
      UPDATE notifications
      SET is_read = true, read_at = COALESCE(read_at, NOW())
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [notificationId, userId]);
    if (result.rowCount === 0) {
      return null;
    }

    logger.info(`[NotificationService] Marked notification ${notificationId} as read by user ${userId}`);
    return this.formatNotification(result.rows[0]);
  }

  /**
   * Mark all unread notifications belonging to the user as read.
   */
  async markAllNotificationsAsRead({ userId }) {
    if (!validateUUID(userId)) {
      const error = new Error('Invalid user ID.');
      error.statusCode = 400;
      throw error;
    }

    const query = `
      UPDATE notifications
      SET is_read = true, read_at = COALESCE(read_at, NOW())
      WHERE user_id = $1 AND is_read = false
      RETURNING id
    `;

    const result = await db.query(query, [userId]);
    const updatedCount = result.rowCount;

    logger.info(`[NotificationService] Marked ${updatedCount} notifications as read for user ${userId}`);

    return {
      updated_count: updatedCount,
    };
  }
}

module.exports = new NotificationService();
