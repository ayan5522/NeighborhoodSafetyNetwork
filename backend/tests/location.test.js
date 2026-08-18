const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const locationService = require('../src/services/locationService');

describe('Module 2: Location & Neighborhood Management Test Suite', () => {
  let userAToken = null;
  let userAId = null;
  let userBToken = null;
  let userBId = null;
  let userCToken = null;
  let userCId = null;

  const testSuffix = Date.now();

  before(async () => {
    // 1. Register User A (Shivaji Nagar, Ratnagiri)
    const userARes = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'Aarav Deshmukh',
        email: `aarav.loc.${testSuffix}@example.com`,
        mobile_number: '+919811111111',
        password: 'Password@123',
        confirm_password: 'Password@123',
      });
    userAId = userARes.body.data.user.id;
    const userAOtp = userARes.body.data.dev_email_otp;
    const userAMobileOtp = userARes.body.data.dev_mobile_otp;

    await request(app).post('/api/auth/verify-email').send({ email: `aarav.loc.${testSuffix}@example.com`, otp: userAOtp });
    await request(app).post('/api/auth/verify-mobile').send({ mobile_number: '+919811111111', otp: userAMobileOtp });

    const loginA = await request(app).post('/api/auth/login').send({
      email: `aarav.loc.${testSuffix}@example.com`,
      password: 'Password@123',
    });
    userAToken = loginA.body.data.token;

    // 2. Register User B (Mandvi, Ratnagiri — ~2.9 km from Shivaji Nagar)
    const userBRes = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'Priya Joshi',
        email: `priya.loc.${testSuffix}@example.com`,
        mobile_number: '+919822222222',
        password: 'Password@123',
        confirm_password: 'Password@123',
      });
    userBId = userBRes.body.data.user.id;
    const userBOtp = userBRes.body.data.dev_email_otp;
    const userBMobileOtp = userBRes.body.data.dev_mobile_otp;

    await request(app).post('/api/auth/verify-email').send({ email: `priya.loc.${testSuffix}@example.com`, otp: userBOtp });
    await request(app).post('/api/auth/verify-mobile').send({ mobile_number: '+919822222222', otp: userBMobileOtp });

    const loginB = await request(app).post('/api/auth/login').send({
      email: `priya.loc.${testSuffix}@example.com`,
      password: 'Password@123',
    });
    userBToken = loginB.body.data.token;

    // 3. Register User C (Mumbai — ~230 km from Ratnagiri)
    const userCRes = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'Rohan Patil',
        email: `rohan.loc.${testSuffix}@example.com`,
        mobile_number: '+919833333333',
        password: 'Password@123',
        confirm_password: 'Password@123',
      });
    userCId = userCRes.body.data.user.id;
    const userCOtp = userCRes.body.data.dev_email_otp;
    const userCMobileOtp = userCRes.body.data.dev_mobile_otp;

    await request(app).post('/api/auth/verify-email').send({ email: `rohan.loc.${testSuffix}@example.com`, otp: userCOtp });
    await request(app).post('/api/auth/verify-mobile').send({ mobile_number: '+919833333333', otp: userCMobileOtp });

    const loginC = await request(app).post('/api/auth/login').send({
      email: `rohan.loc.${testSuffix}@example.com`,
      password: 'Password@123',
    });
    userCToken = loginC.body.data.token;
  });

  after(async () => {
    // Cleanup created test records
    if (userAId || userBId || userCId) {
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [userAId, userBId, userCId]);
    }
  });

  describe('1. PostGIS Spatial Foundation & Distance Calculation', () => {
    test('Test 1: should verify PostGIS extension and spatial point calculation', async () => {
      const res = await db.query("SELECT PostGIS_Full_Version() as version");
      assert.ok(res.rows.length > 0, 'PostGIS should be installed');
      assert.ok(res.rows[0].version.includes('POSTGIS'), 'PostGIS version string should be present');
    });

    test('Test 2: should calculate accurate geodesic distance using PostGIS ST_Distance', async () => {
      // Distance between Shivaji Nagar (16.9902, 73.3120) and Mandvi Beach (16.9850, 73.2850)
      const distance = await locationService.calculateDistance(16.9902, 73.3120, 16.9850, 73.2850);
      assert.ok(typeof distance === 'number');
      // Geodesic distance should be ~2900 meters (+/- 200m)
      assert.ok(distance > 2700 && distance < 3100, `Expected ~2900m distance, got ${distance}m`);
    });
  });

  describe('2. Location Input Validation', () => {
    test('Test 3: should reject location update without authentication (401)', async () => {
      const res = await request(app)
        .post('/api/location')
        .send({ latitude: 16.9902, longitude: 73.3120, accuracy: 10 });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 4: should reject invalid latitude (> 90 or < -90)', async () => {
      const res = await request(app)
        .post('/api/location')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ latitude: 95.5, longitude: 73.3120 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 5: should reject invalid longitude (> 180 or < -180)', async () => {
      const res = await request(app)
        .post('/api/location')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ latitude: 16.9902, longitude: -195.0 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 6: should reject negative accuracy value', async () => {
      const res = await request(app)
        .post('/api/location')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ latitude: 16.9902, longitude: 73.3120, accuracy: -15 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  describe('3. Location Storage & Upsert (POST /api/location)', () => {
    test('Test 7: should successfully save user A location in Ratnagiri', async () => {
      const res = await request(app)
        .post('/api/location')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          latitude: 16.9902,
          longitude: 73.3120,
          accuracy: 8.5,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user_id, userAId);
      assert.strictEqual(res.body.data.latitude, 16.9902);
      assert.strictEqual(res.body.data.longitude, 73.3120);
      assert.strictEqual(res.body.data.accuracy, 8.5);
      assert.ok(res.body.data.neighborhood_name);
    });

    test('Test 8: should successfully upsert location without creating duplicate rows', async () => {
      // Update with new accuracy and slight GPS movement
      const res = await request(app)
        .post('/api/location')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          latitude: 16.9905,
          longitude: 73.3125,
          accuracy: 5.0,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.latitude, 16.9905);
      assert.strictEqual(res.body.data.accuracy, 5.0);

      // Verify only 1 row exists for User A
      const countRes = await db.query('SELECT COUNT(*) FROM user_locations WHERE user_id = $1', [userAId]);
      assert.strictEqual(parseInt(countRes.rows[0].count, 10), 1);
    });

    test('Test 9: should save user B location in Mandvi Beach (~2.9 km away)', async () => {
      const res = await request(app)
        .post('/api/location')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          latitude: 16.9850,
          longitude: 73.2850,
          accuracy: 12.0,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.user_id, userBId);
    });

    test('Test 10: should save user C location in Mumbai (~230 km away)', async () => {
      const res = await request(app)
        .post('/api/location')
        .set('Authorization', `Bearer ${userCToken}`)
        .send({
          latitude: 19.0760,
          longitude: 72.8777,
          accuracy: 15.0,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.user_id, userCId);
    });
  });

  describe('4. Retrieval of Current User Location (GET /api/location/me)', () => {
    test('Test 11: should retrieve own location with authenticated JWT', async () => {
      const res = await request(app)
        .get('/api/location/me')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user_id, userAId);
      assert.strictEqual(res.body.data.latitude, 16.9905);
      assert.strictEqual(res.body.data.longitude, 73.3125);
    });

    test('Test 12: should reject unauthenticated request to /api/location/me', async () => {
      const res = await request(app).get('/api/location/me');
      assert.strictEqual(res.status, 401);
    });
  });

  describe('5. PostGIS Radius & Nearby Safety Perimeter (GET /api/location/nearby)', () => {
    test('Test 13: User B (~2.9 km away) should NOT be in 2 km radius query of User A', async () => {
      const res = await request(app)
        .get('/api/location/nearby?radius=2000')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.radius_meters, 2000);
      // At 2000m, User B (~2.9km) is out of range
      assert.strictEqual(res.body.data.active_residents_nearby, 0);
    });

    test('Test 14: User B (~2.9 km away) SHOULD be found in 5 km radius query of User A', async () => {
      const res = await request(app)
        .get('/api/location/nearby?radius=5000')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.active_residents_nearby, 1);
      assert.strictEqual(res.body.data.safety_circle_status, 'PROTECTED');
    });

    test('Test 15: User C (Mumbai, ~230 km away) must be excluded from 5 km radius', async () => {
      const res = await request(app)
        .get('/api/location/nearby?radius=5000')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.active_residents_nearby, 1); // Only User B, NOT User C
    });

    test('Test 16: STRICT PRIVACY RULE — Nearby search must NEVER leak exact coordinates, emails, or names', async () => {
      const res = await request(app)
        .get('/api/location/nearby?radius=5000')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      const nodes = res.body.data.nearby_nodes;
      assert.ok(Array.isArray(nodes));
      assert.strictEqual(nodes.length, 1);

      const node = nodes[0];
      // Check privacy compliance:
      assert.strictEqual(node.latitude, undefined, 'Privacy breach: exact latitude must not be exposed');
      assert.strictEqual(node.longitude, undefined, 'Privacy breach: exact longitude must not be exposed');
      assert.strictEqual(node.user_id, undefined, 'Privacy breach: user_id must not be exposed');
      assert.strictEqual(node.full_name, undefined, 'Privacy breach: full_name must not be exposed');
      assert.strictEqual(node.email, undefined, 'Privacy breach: email must not be exposed');
      assert.strictEqual(node.mobile_number, undefined, 'Privacy breach: mobile_number must not be exposed');
      // Approximate distance (rounded to 50m) and area are permitted
      assert.ok(node.approximate_distance_meters % 50 === 0, 'Distance must be rounded to nearest 50m');
      assert.ok(typeof node.approximate_area === 'string');
    });
  });

  describe('6. Neighborhood & Locality Endpoint (GET /api/location/neighborhood)', () => {
    test('Test 17: should return approximate neighborhood information for authenticated user', async () => {
      const res = await request(app)
        .get('/api/location/neighborhood')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.neighborhood_name);
      assert.ok(res.body.data.locality);
    });
  });
});
