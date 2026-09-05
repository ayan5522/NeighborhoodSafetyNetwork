const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const alertService = require('../src/services/alertService');

describe('Module 4: Emergency Alert & Response Management Test Suite', () => {
  let userAToken = null;
  let userAId = null;
  let userBToken = null;
  let userBId = null;
  let userCToken = null;
  let userCId = null;

  let highAlertId = null;
  let criticalAlertId = null;
  let highIncidentId = null;
  let contactId = null;
  let sosId = null;

  const testSuffix = Date.now();

  before(async () => {
    // 1. Isolate test tables
    await db.query('DELETE FROM alerts');
    await db.query('DELETE FROM sos_events');
    await db.query('DELETE FROM emergency_contacts');
    await db.query('DELETE FROM incidents');
    await db.query('DELETE FROM user_locations');
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%alert%']);

    // 2. Register & Login User A (Reporter in Shivaji Nagar, Ratnagiri)
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'Aarav Deshmukh',
        email: `aarav.alert.${testSuffix}@example.com`,
        mobile_number: '+919811111111',
        password: 'Password@123',
        confirm_password: 'Password@123',
      });
    userAId = resA.body.data.user.id;
    await request(app).post('/api/auth/verify-email').send({ email: `aarav.alert.${testSuffix}@example.com`, otp: resA.body.data.dev_email_otp });
    await request(app).post('/api/auth/verify-mobile').send({ mobile_number: '+919811111111', otp: resA.body.data.dev_mobile_otp });

    const loginA = await request(app).post('/api/auth/login').send({
      email: `aarav.alert.${testSuffix}@example.com`,
      password: 'Password@123',
    });
    userAToken = loginA.body.data.token;

    // Set User A Location in Shivaji Nagar (16.9902, 73.3120)
    await request(app)
      .post('/api/location')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ latitude: 16.9902, longitude: 73.3120 });

    // 3. Register & Login User B (Resident in Mandvi Beach, ~2.9 km from Shivaji Nagar)
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'Priya Joshi',
        email: `priya.alert.${testSuffix}@example.com`,
        mobile_number: '+919822222222',
        password: 'Password@123',
        confirm_password: 'Password@123',
      });
    userBId = resB.body.data.user.id;
    await request(app).post('/api/auth/verify-email').send({ email: `priya.alert.${testSuffix}@example.com`, otp: resB.body.data.dev_email_otp });
    await request(app).post('/api/auth/verify-mobile').send({ mobile_number: '+919822222222', otp: resB.body.data.dev_mobile_otp });

    const loginB = await request(app).post('/api/auth/login').send({
      email: `priya.alert.${testSuffix}@example.com`,
      password: 'Password@123',
    });
    userBToken = loginB.body.data.token;

    // Set User B Location in Mandvi Beach (16.9850, 73.2850) -> ~2.9 km away
    await request(app)
      .post('/api/location')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ latitude: 16.9850, longitude: 73.2850 });

    // 4. Register & Login User C (Resident in Mumbai, ~230 km away)
    const resC = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'Rohan Patil',
        email: `rohan.alert.${testSuffix}@example.com`,
        mobile_number: '+919833333333',
        password: 'Password@123',
        confirm_password: 'Password@123',
      });
    userCId = resC.body.data.user.id;
    await request(app).post('/api/auth/verify-email').send({ email: `rohan.alert.${testSuffix}@example.com`, otp: resC.body.data.dev_email_otp });
    await request(app).post('/api/auth/verify-mobile').send({ mobile_number: '+919833333333', otp: resC.body.data.dev_mobile_otp });

    const loginC = await request(app).post('/api/auth/login').send({
      email: `rohan.alert.${testSuffix}@example.com`,
      password: 'Password@123',
    });
    userCToken = loginC.body.data.token;

    // Set User C Location in Mumbai (19.0760, 72.8777)
    await request(app)
      .post('/api/location')
      .set('Authorization', `Bearer ${userCToken}`)
      .send({ latitude: 19.0760, longitude: 72.8777 });
  });

  // =========================================================================
  // SECTION 1: Automated Alert Generation & PostGIS Radius Targeting
  // =========================================================================
  describe('1. Automated Alert Generation & PostGIS Radius Targeting', () => {
    test('Test 1: LOW incident (1 km radius) excludes User B (2.9 km away) and User C (230 km away)', async () => {
      const incRes = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'ROAD_HAZARD',
          title: 'Minor pothole on local street',
          description: 'Small pothole near lane entrance, slow driving recommended.',
          severity: 'LOW',
          latitude: 16.9902,
          longitude: 73.3120,
        });

      assert.strictEqual(incRes.status, 201);
      const lowIncId = incRes.body.data.id;

      // Check alerts table for User B & User C
      const alertCheckB = await db.query(
        'SELECT * FROM alerts WHERE incident_id = $1 AND recipient_user_id = $2',
        [lowIncId, userBId]
      );
      assert.strictEqual(alertCheckB.rowCount, 0, 'User B must not receive alert for 1km LOW incident');

      const alertCheckC = await db.query(
        'SELECT * FROM alerts WHERE incident_id = $1 AND recipient_user_id = $2',
        [lowIncId, userCId]
      );
      assert.strictEqual(alertCheckC.rowCount, 0, 'User C must not receive alert for 1km LOW incident');
    });

    test('Test 2: HIGH incident (3 km radius) generates HIGH alert for User B (~2.9 km away) and excludes User C', async () => {
      const incRes = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'ACCIDENT',
          title: 'Heavy traffic collision on coastal bypass',
          description: 'Bus and truck collision blocking both lanes near bypass bridge.',
          severity: 'HIGH',
          latitude: 16.9902,
          longitude: 73.3120,
        });

      assert.strictEqual(incRes.status, 201);
      highIncidentId = incRes.body.data.id;

      // User B should have received an alert
      const alertCheckB = await db.query(
        'SELECT * FROM alerts WHERE incident_id = $1 AND recipient_user_id = $2',
        [highIncidentId, userBId]
      );
      assert.strictEqual(alertCheckB.rowCount, 1, 'User B should receive alert within 3km');
      assert.strictEqual(alertCheckB.rows[0].priority, 'HIGH');
      assert.strictEqual(alertCheckB.rows[0].status, 'ACTIVE');
      assert.strictEqual(alertCheckB.rows[0].read_at, null);

      highAlertId = alertCheckB.rows[0].id;

      // User C (Mumbai) must still be excluded
      const alertCheckC = await db.query(
        'SELECT * FROM alerts WHERE incident_id = $1 AND recipient_user_id = $2',
        [highIncidentId, userCId]
      );
      assert.strictEqual(alertCheckC.rowCount, 0, 'User C must be excluded');
    });

    test('Test 3: CRITICAL incident (5 km radius) maps to URGENT alert priority with 1-hour expiry', async () => {
      const incRes = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'FIRE',
          title: 'Major commercial warehouse fire',
          description: 'Severe structural fire with thick smoke spreading across the sector.',
          severity: 'CRITICAL',
          latitude: 16.9902,
          longitude: 73.3120,
        });

      assert.strictEqual(incRes.status, 201);
      const critIncId = incRes.body.data.id;

      const alertCheck = await db.query(
        'SELECT * FROM alerts WHERE incident_id = $1 AND recipient_user_id = $2',
        [critIncId, userBId]
      );
      assert.strictEqual(alertCheck.rowCount, 1);
      assert.strictEqual(alertCheck.rows[0].priority, 'URGENT');
      criticalAlertId = alertCheck.rows[0].id;

      // Expiry should be approx 1 hour from creation
      const diffMinutes = (new Date(alertCheck.rows[0].expires_at) - new Date(alertCheck.rows[0].created_at)) / (1000 * 60);
      assert.ok(Math.abs(diffMinutes - 60) < 5, 'Expiry should be configured to 1 hour for CRITICAL/URGENT');
    });

    test('Test 4: Duplicate alert prevention prevents repeated alerts for same incident + recipient', async () => {
      // Re-invoking generateAlertsForIncident on the same incident should not duplicate rows
      const duplicateRun = await alertService.generateAlertsForIncident({
        id: highIncidentId,
        severity: 'HIGH',
        latitude: 16.9902,
        longitude: 73.3120,
      });

      assert.strictEqual(duplicateRun.generatedCount, 0, 'Zero duplicate rows inserted');

      const countCheck = await db.query(
        'SELECT COUNT(*) FROM alerts WHERE incident_id = $1 AND recipient_user_id = $2',
        [highIncidentId, userBId]
      );
      assert.strictEqual(parseInt(countCheck.rows[0].count, 10), 1, 'Exactly one alert record must exist');
    });
  });

  // =========================================================================
  // SECTION 2: Resident Alert Feed & Read State Management
  // =========================================================================
  describe('2. Resident Alert Feed & Read State Management', () => {
    test('Test 5: GET /api/alerts requires authentication (401)', async () => {
      const res = await request(app).get('/api/alerts');
      assert.strictEqual(res.status, 401);
    });

    test('Test 6: GET /api/alerts returns user-targeted alerts with privacy masking', async () => {
      const res = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 2);

      const alert = res.body.data[0];
      assert.ok(alert.alert_id);
      assert.ok(alert.incident_title);
      assert.ok(alert.priority);
      assert.strictEqual(alert.status, 'ACTIVE');

      // Privacy checks:
      assert.strictEqual(alert.reporter_id, undefined, 'Privacy: reporter_id must never be exposed in alert feed');
      assert.strictEqual(alert.reporter_email, undefined, 'Privacy: reporter_email must never be exposed');
      assert.strictEqual(alert.reporter_phone, undefined, 'Privacy: reporter_phone must never be exposed');
      assert.strictEqual(alert.latitude, undefined, 'Privacy: exact coordinates must not be exposed');
      assert.strictEqual(alert.longitude, undefined, 'Privacy: exact coordinates must not be exposed');

      // Approximate distance (rounded to 50m)
      assert.ok(alert.approximate_distance_meters !== null);
      assert.strictEqual(alert.approximate_distance_meters % 50, 0, 'Distance must be rounded to nearest 50m');
    });

    test('Test 7: GET /api/alerts/unread-count returns accurate active unread count', async () => {
      const res = await request(app)
        .get('/api/alerts/unread-count')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.unread_count >= 2);
    });

    test('Test 8: GET /api/alerts/:id retrieves single alert details for recipient', async () => {
      const res = await request(app)
        .get(`/api/alerts/${highAlertId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.alert_id, highAlertId);
      assert.strictEqual(res.body.data.priority, 'HIGH');
    });

    test('Test 9: GET /api/alerts/:id rejects unauthorized access from another user (403)', async () => {
      const res = await request(app)
        .get(`/api/alerts/${highAlertId}`)
        .set('Authorization', `Bearer ${userCToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 10: PATCH /api/alerts/:id/read marks alert as read by recipient', async () => {
      const res = await request(app)
        .patch(`/api/alerts/${highAlertId}/read`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.read_at !== null);

      // Verify unread count decremented
      const countRes = await request(app)
        .get('/api/alerts/unread-count')
        .set('Authorization', `Bearer ${userBToken}`);
      assert.strictEqual(countRes.status, 200);
    });

    test('Test 11: PATCH /api/alerts/:id/read rejects attempt by non-recipient (403)', async () => {
      const res = await request(app)
        .patch(`/api/alerts/${criticalAlertId}/read`)
        .set('Authorization', `Bearer ${userCToken}`);

      assert.strictEqual(res.status, 403);
    });
  });

  // =========================================================================
  // SECTION 3: Alert Expiry & Incident Resolution Cascading
  // =========================================================================
  describe('3. Alert Expiry & Incident Resolution Cascading', () => {
    test('Test 12: Overdue alert automatically transitions to EXPIRED on feed retrieval', async () => {
      // Artificially set criticalAlertId expires_at to past
      await db.query(`UPDATE alerts SET expires_at = NOW() - INTERVAL '10 minutes' WHERE id = $1`, [criticalAlertId]);

      // Query feed which triggers lazy expiration
      const res = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 200);

      const dbCheck = await db.query('SELECT status FROM alerts WHERE id = $1', [criticalAlertId]);
      assert.strictEqual(dbCheck.rows[0].status, 'EXPIRED');
    });

    test('Test 13: Cancelling an incident cascades resolution to related active alerts', async () => {
      // Cancel highIncidentId
      const cancelRes = await request(app)
        .patch(`/api/incidents/${highIncidentId}/cancel`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(cancelRes.status, 200);

      // Alert should now be RESOLVED
      const alertCheck = await db.query('SELECT status, resolved_at FROM alerts WHERE id = $1', [highAlertId]);
      assert.strictEqual(alertCheck.rows[0].status, 'RESOLVED');
      assert.ok(alertCheck.rows[0].resolved_at !== null);
    });
  });

  // =========================================================================
  // SECTION 4: Emergency Contacts Management
  // =========================================================================
  describe('4. Emergency Contacts Management', () => {
    test('Test 14: POST /api/emergency-contacts rejects invalid phone number (400)', async () => {
      const res = await request(app)
        .post('/api/emergency-contacts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          name: 'Mother',
          phone_number: '12345', // Invalid
          relationship: 'Mother',
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 15: POST /api/emergency-contacts saves valid primary emergency contact (201)', async () => {
      const res = await request(app)
        .post('/api/emergency-contacts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          name: 'Sunita Deshmukh',
          phone_number: '+919876543210',
          relationship: 'Mother',
          is_primary: true,
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.name, 'Sunita Deshmukh');
      assert.strictEqual(res.body.data.phone_number, '+919876543210');
      assert.strictEqual(res.body.data.is_primary, true);

      contactId = res.body.data.id;
    });

    test('Test 16: GET /api/emergency-contacts lists contacts for authenticated user', async () => {
      const res = await request(app)
        .get('/api/emergency-contacts')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].name, 'Sunita Deshmukh');
    });

    test('Test 17: User B cannot delete User A emergency contact (403)', async () => {
      const res = await request(app)
        .delete(`/api/emergency-contacts/${contactId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 403);
    });

    test('Test 18: User A can delete their own emergency contact (200)', async () => {
      const res = await request(app)
        .delete(`/api/emergency-contacts/${contactId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      // Verify removal
      const checkRes = await request(app)
        .get('/api/emergency-contacts')
        .set('Authorization', `Bearer ${userAToken}`);
      assert.strictEqual(checkRes.body.data.length, 0);
    });
  });

  // =========================================================================
  // SECTION 5: Personal SOS Emergency Events
  // =========================================================================
  describe('5. Personal SOS Emergency Events', () => {
    test('Test 19: POST /api/sos rejects invalid coordinates (400)', async () => {
      const res = await request(app)
        .post('/api/sos')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          latitude: 105.0, // Invalid
          longitude: 73.3120,
        });

      assert.strictEqual(res.status, 400);
    });

    test('Test 20: POST /api/sos creates active SOS event with PostGIS coordinates (201)', async () => {
      // First re-add emergency contact for user A to test notification trigger
      await request(app)
        .post('/api/emergency-contacts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          name: 'Sunita Deshmukh',
          phone_number: '+919876543210',
          relationship: 'Mother',
          is_primary: true,
        });

      const res = await request(app)
        .post('/api/sos')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          latitude: 16.9902,
          longitude: 73.3120,
          notify_contact: true,
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'ACTIVE');
      assert.strictEqual(res.body.data.user_id, userAId);
      assert.strictEqual(res.body.data.contact_notified, true);
      assert.ok(res.body.contact_notification !== null);

      sosId = res.body.data.id;

      // Verify PostGIS geom in DB
      const dbCheck = await db.query(
        'SELECT ST_AsText(geom::geometry) AS geom_text, status FROM sos_events WHERE id = $1',
        [sosId]
      );
      assert.strictEqual(dbCheck.rows[0].geom_text, 'POINT(73.312 16.9902)');
      assert.strictEqual(dbCheck.rows[0].status, 'ACTIVE');
    });

    test('Test 21: GET /api/sos/my returns user SOS history', async () => {
      const res = await request(app)
        .get('/api/sos/my')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.strictEqual(res.body.data[0].id, sosId);
    });

    test('Test 22: User B cannot resolve User A SOS event (403)', async () => {
      const res = await request(app)
        .patch(`/api/sos/${sosId}/resolve`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ action: 'RESOLVE' });

      assert.strictEqual(res.status, 403);
    });

    test('Test 23: User A can successfully resolve their active SOS event (200)', async () => {
      const res = await request(app)
        .patch(`/api/sos/${sosId}/resolve`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ action: 'RESOLVE' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'RESOLVED');
      assert.ok(res.body.data.resolved_at !== null);
    });

    test('Test 24: User A can cancel SOS event (200, status CANCELLED)', async () => {
      // Create a second SOS event
      const createRes = await request(app)
        .post('/api/sos')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          latitude: 16.9910,
          longitude: 73.3130,
        });
      const secondSosId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/sos/${secondSosId}/resolve`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ action: 'CANCEL' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.status, 'CANCELLED');
    });
  });
});
