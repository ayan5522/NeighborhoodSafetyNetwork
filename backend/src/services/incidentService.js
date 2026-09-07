const db = require('../config/db');
const { INCIDENT_STATUS } = require('../constants/incidentStatus');
const logger = require('../utils/logger');

class IncidentService {
  /**
   * Helper to format safe incident object for API responses.
   */
  formatIncident(row) {
    if (!row) return null;
    return {
      id: row.id,
      reporter_id: row.reporter_id,
      category: row.category,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      image_url: row.image_url || null,
      neighborhood_name: row.neighborhood_name || null,
      locality: row.locality || null,
      city: row.city || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Create a new neighborhood safety incident.
   */
  async createIncident({
    reporterId,
    category,
    title,
    description,
    severity,
    latitude,
    longitude,
    imageUrl = null,
  }) {
    const lat = Number(latitude);
    const lng = Number(longitude);

    // Fetch user's locality if available or default
    let areaInfo = { neighborhood_name: null, locality: null, city: null };
    try {
      const locRes = await db.query(
        'SELECT neighborhood_name, locality, city FROM user_locations WHERE user_id = $1::uuid',
        [reporterId]
      );
      if (locRes.rows.length > 0) {
        areaInfo = locRes.rows[0];
      }
    } catch (e) {}

    const query = `
      INSERT INTO incidents (
        reporter_id,
        category,
        title,
        description,
        severity,
        status,
        latitude,
        longitude,
        geom,
        image_url,
        neighborhood_name,
        locality,
        city,
        created_at,
        updated_at
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::numeric,
        $8::numeric,
        ST_SetSRID(ST_MakePoint($8::double precision, $7::double precision), 4326)::geography,
        $9,
        $10,
        $11,
        $12,
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    const result = await db.query(query, [
      reporterId,
      category,
      title,
      description,
      severity,
      INCIDENT_STATUS.PENDING,
      lat,
      lng,
      imageUrl,
      areaInfo.neighborhood_name,
      areaInfo.locality,
      areaInfo.city,
    ]);

    const createdIncident = result.rows[0];
    logger.info(`Incident reported: ${createdIncident.id} by user ${reporterId} (${category} - ${severity})`);

    // Automatically trigger Module 4 Alert Generation for eligible nearby users
    try {
      const alertService = require('./alertService');
      await alertService.generateAlertsForIncident(createdIncident);
    } catch (alertErr) {
      logger.warn(`[IncidentService] Non-fatal alert generation error for incident ${createdIncident.id}: ${alertErr.message}`);
    }

    return {
      success: true,
      statusCode: 201,
      message: 'Incident reported successfully.',
      data: this.formatIncident(createdIncident),
    };
  }

  /**
   * Get all incidents reported by the authenticated user.
   */
  async getMyIncidents({ reporterId, page = 1, limit = 20 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const countQuery = 'SELECT COUNT(*) FROM incidents WHERE reporter_id = $1::uuid';
    const countRes = await db.query(countQuery, [reporterId]);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT *
      FROM incidents
      WHERE reporter_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [reporterId, limitNum, offset]);

    return {
      success: true,
      statusCode: 200,
      message: 'My reports retrieved successfully.',
      data: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        reports: result.rows.map((row) => this.formatIncident(row)),
      },
    };
  }

  /**
   * Get single incident details with strict reporter ownership authorization.
   */
  async getIncidentById({ incidentId, userId }) {
    const query = 'SELECT * FROM incidents WHERE id = $1::uuid';
    const result = await db.query(query, [incidentId]);

    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: 'Incident report not found.',
      };
    }

    const incident = result.rows[0];

    // Ownership check: for Module 3, only the reporter can view their detailed report
    if (incident.reporter_id !== userId) {
      return {
        success: false,
        statusCode: 403,
        message: 'Access forbidden. You can only view your own incident reports.',
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Incident details retrieved successfully.',
      data: this.formatIncident(incident),
    };
  }

  /**
   * Update an incident (only allowed if PENDING and owned by user).
   */
  async updateIncident({ incidentId, userId, category, title, description, severity }) {
    const checkQuery = 'SELECT * FROM incidents WHERE id = $1::uuid';
    const checkRes = await db.query(checkQuery, [incidentId]);

    if (checkRes.rows.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: 'Incident report not found.',
      };
    }

    const existing = checkRes.rows[0];

    // Ownership check
    if (existing.reporter_id !== userId) {
      return {
        success: false,
        statusCode: 403,
        message: 'Access forbidden. You can only edit your own incident reports.',
      };
    }

    // State check: only PENDING incidents are editable
    if (existing.status !== INCIDENT_STATUS.PENDING) {
      return {
        success: false,
        statusCode: 400,
        message: `Cannot edit incident in '${existing.status}' status. Only PENDING reports can be edited.`,
      };
    }

    const updatedCategory = category || existing.category;
    const updatedTitle = title || existing.title;
    const updatedDescription = description || existing.description;
    const updatedSeverity = severity || existing.severity;

    const updateQuery = `
      UPDATE incidents
      SET 
        category = $1,
        title = $2,
        description = $3,
        severity = $4,
        updated_at = NOW()
      WHERE id = $5::uuid
      RETURNING *
    `;

    const updateRes = await db.query(updateQuery, [
      updatedCategory,
      updatedTitle,
      updatedDescription,
      updatedSeverity,
      incidentId,
    ]);

    logger.info(`Incident updated: ${incidentId} by user ${userId}`);

    return {
      success: true,
      statusCode: 200,
      message: 'Incident report updated successfully.',
      data: this.formatIncident(updateRes.rows[0]),
    };
  }

  /**
   * Cancel an incident report (sets status to CANCELLED, preserves audit trail).
   */
  async cancelIncident({ incidentId, userId }) {
    const checkQuery = 'SELECT * FROM incidents WHERE id = $1::uuid';
    const checkRes = await db.query(checkQuery, [incidentId]);

    if (checkRes.rows.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: 'Incident report not found.',
      };
    }

    const existing = checkRes.rows[0];

    // Ownership check
    if (existing.reporter_id !== userId) {
      return {
        success: false,
        statusCode: 403,
        message: 'Access forbidden. You can only cancel your own incident reports.',
      };
    }

    if (existing.status === INCIDENT_STATUS.CANCELLED) {
      return {
        success: false,
        statusCode: 400,
        message: 'Incident is already cancelled.',
      };
    }

    if (existing.status === INCIDENT_STATUS.RESOLVED) {
      return {
        success: false,
        statusCode: 400,
        message: 'Resolved incidents cannot be cancelled.',
      };
    }

    const updateQuery = `
      UPDATE incidents
      SET status = $1, updated_at = NOW()
      WHERE id = $2::uuid
      RETURNING *
    `;

    const updateRes = await db.query(updateQuery, [INCIDENT_STATUS.CANCELLED, incidentId]);

    logger.info(`Incident cancelled: ${incidentId} by user ${userId}`);

    // Resolve associated alerts
    try {
      const alertService = require('./alertService');
      await alertService.resolveAlertsForIncident({ incidentId });
    } catch (alertErr) {
      logger.warn(`[IncidentService] Non-fatal alert resolution error for incident ${incidentId}: ${alertErr.message}`);
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Incident report has been cancelled successfully.',
      data: this.formatIncident(updateRes.rows[0]),
    };
  }

  /**
   * Get active nearby safety incidents within a radius using PostGIS.
   * Strictly filters for active incidents (PENDING, ACTIVE) - excludes CANCELLED and RESOLVED.
   * Enforces privacy by excluding reporter credentials, names, emails, phone numbers.
   * Left joins alerts to link alert_id if one was issued to this recipient user.
   */
  async getNearbyActiveIncidents({ userId, latitude, longitude, radiusMeters = 2000, category, severity }) {
    let centerLat = latitude !== undefined && latitude !== null ? Number(latitude) : null;
    let centerLng = longitude !== undefined && longitude !== null ? Number(longitude) : null;

    if (centerLat === null || centerLng === null) {
      const userLoc = await db.query(
        'SELECT latitude, longitude FROM user_locations WHERE user_id = $1::uuid',
        [userId]
      );
      if (userLoc.rows.length === 0) {
        return {
          success: false,
          statusCode: 400,
          message: 'Current coordinates required or user location must be saved first.',
        };
      }
      centerLat = parseFloat(userLoc.rows[0].latitude);
      centerLng = parseFloat(userLoc.rows[0].longitude);
    }

    const radius = Number(radiusMeters) || 2000;
    const queryParams = [centerLat, centerLng, userId, radius];
    const filterClauses = [];

    if (category) {
      queryParams.push(category);
      filterClauses.push(`AND i.category = $${queryParams.length}`);
    }

    if (severity) {
      queryParams.push(severity);
      filterClauses.push(`AND i.severity = $${queryParams.length}`);
    }

    const query = `
      SELECT 
        i.id,
        i.category,
        i.title,
        i.description,
        i.severity,
        i.status,
        i.latitude,
        i.longitude,
        i.image_url,
        i.neighborhood_name,
        i.locality,
        i.city,
        i.created_at,
        i.updated_at,
        ROUND(ST_Distance(i.geom, ST_SetSRID(ST_MakePoint($2::double precision, $1::double precision), 4326)::geography)) AS distance_meters,
        a.id AS alert_id
      FROM incidents i
      LEFT JOIN alerts a ON a.incident_id = i.id AND a.recipient_user_id = $3::uuid
      WHERE i.status IN ('PENDING', 'ACTIVE')
        AND ST_DWithin(
          i.geom,
          ST_SetSRID(ST_MakePoint($2::double precision, $1::double precision), 4326)::geography,
          $4::double precision
        )
        ${filterClauses.join(' ')}
      ORDER BY distance_meters ASC
    `;

    const result = await db.query(query, queryParams);

    const formattedIncidents = result.rows.map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      image_url: row.image_url || null,
      neighborhood_name: row.neighborhood_name || null,
      locality: row.locality || null,
      city: row.city || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      distance_meters: parseFloat(row.distance_meters),
      approximate_distance_meters: Math.round(parseFloat(row.distance_meters) / 50) * 50,
      alert_id: row.alert_id || null,
    }));

    return {
      success: true,
      statusCode: 200,
      message: 'Nearby active incidents retrieved successfully.',
      data: {
        radius_meters: radius,
        center: {
          latitude: centerLat,
          longitude: centerLng,
        },
        total: formattedIncidents.length,
        incidents: formattedIncidents,
      },
    };
  }
}

module.exports = new IncidentService();
