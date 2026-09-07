const db = require('../config/db');
const { VERIFICATION_TYPES, COMMUNITY_STATUS } = require('../constants/verificationTypes');
const logger = require('../utils/logger');

class VerificationService {
  /**
   * Determine community verification status based on confirm vs dispute counts.
   * Deterministic rule isolated for future AI trust scoring integration in Module 6.
   *
   * Rules:
   * - 0 confirms, 0 disputes -> UNVERIFIED
   * - confirmCount > disputeCount -> COMMUNITY_CONFIRMED
   * - disputeCount > confirmCount -> COMMUNITY_DISPUTED
   * - confirmCount == disputeCount (both > 0) -> UNVERIFIED
   */
  calculateCommunityStatus(confirmCount, disputeCount) {
    const confirms = Number(confirmCount) || 0;
    const disputes = Number(disputeCount) || 0;

    if (confirms === 0 && disputes === 0) {
      return COMMUNITY_STATUS.UNVERIFIED;
    }
    if (confirms > disputes) {
      return COMMUNITY_STATUS.COMMUNITY_CONFIRMED;
    }
    if (disputes > confirms) {
      return COMMUNITY_STATUS.COMMUNITY_DISPUTED;
    }
    // Equal non-zero confirms and disputes
    return COMMUNITY_STATUS.UNVERIFIED;
  }

  /**
   * Submit a verification (CONFIRM or DISPUTE) for an incident.
   */
  async submitVerification({ incidentId, userId, verificationType }) {
    // 1. Verify incident exists
    const incidentQuery = `SELECT id, reporter_id, status FROM incidents WHERE id = $1`;
    let incidentRes;
    try {
      incidentRes = await db.query(incidentQuery, [incidentId]);
    } catch (err) {
      if (err.code === '22P02') {
        // Invalid UUID format
        return {
          success: false,
          statusCode: 404,
          message: 'Incident not found.',
        };
      }
      throw err;
    }

    if (incidentRes.rows.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: 'Incident not found.',
      };
    }

    const incident = incidentRes.rows[0];

    // 2. Prevent reporter from verifying their own incident
    if (incident.reporter_id === userId) {
      return {
        success: false,
        statusCode: 400,
        message: 'You cannot verify your own reported incident.',
      };
    }

    // 3. Check for existing verification by this user
    const checkQuery = `
      SELECT id, verification_type 
      FROM incident_verifications 
      WHERE incident_id = $1 AND user_id = $2
    `;
    const checkRes = await db.query(checkQuery, [incidentId, userId]);

    if (checkRes.rows.length > 0) {
      return {
        success: false,
        statusCode: 409,
        message: 'You have already submitted a verification for this incident.',
      };
    }

    // 4. Insert verification record
    const insertQuery = `
      INSERT INTO incident_verifications (
        incident_id,
        user_id,
        verification_type,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING id, incident_id, verification_type, created_at, updated_at
    `;

    const insertRes = await db.query(insertQuery, [incidentId, userId, verificationType]);
    const created = insertRes.rows[0];

    logger.info(`Verification submitted: ${verificationType} on incident ${incidentId} by user ${userId}`);

    return {
      success: true,
      statusCode: 201,
      message: 'Verification submitted successfully.',
      data: {
        id: created.id,
        incident_id: created.incident_id,
        verification_type: created.verification_type,
        created_at: created.created_at,
      },
    };
  }

  /**
   * Get aggregated verification counts and community status for an incident.
   * Privacy-safe: never returns verifier emails, phones, or passwords.
   */
  async getIncidentVerifications({ incidentId, userId }) {
    // 1. Check if incident exists
    const checkQuery = `SELECT id FROM incidents WHERE id = $1`;
    let checkRes;
    try {
      checkRes = await db.query(checkQuery, [incidentId]);
    } catch (err) {
      if (err.code === '22P02') {
        return {
          success: false,
          statusCode: 404,
          message: 'Incident not found.',
        };
      }
      throw err;
    }

    if (checkRes.rows.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: 'Incident not found.',
      };
    }

    // 2. Query aggregated counts
    const countQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE verification_type = 'CONFIRM') AS confirm_count,
        COUNT(*) FILTER (WHERE verification_type = 'DISPUTE') AS dispute_count
      FROM incident_verifications
      WHERE incident_id = $1
    `;
    const countRes = await db.query(countQuery, [incidentId]);
    const confirmCount = parseInt(countRes.rows[0].confirm_count || 0, 10);
    const disputeCount = parseInt(countRes.rows[0].dispute_count || 0, 10);

    // 3. Determine status
    const status = this.calculateCommunityStatus(confirmCount, disputeCount);

    // 4. Query current user's verification if authenticated
    let myVerification = null;
    if (userId) {
      const myQuery = `
        SELECT verification_type 
        FROM incident_verifications 
        WHERE incident_id = $1 AND user_id = $2
      `;
      const myRes = await db.query(myQuery, [incidentId, userId]);
      if (myRes.rows.length > 0) {
        myVerification = myRes.rows[0].verification_type;
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Incident verification summary retrieved successfully.',
      data: {
        incident_id: incidentId,
        confirm_count: confirmCount,
        dispute_count: disputeCount,
        status,
        my_verification: myVerification,
      },
    };
  }
}

module.exports = new VerificationService();
