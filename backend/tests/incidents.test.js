const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const db = require('../src/config/db');

describe('Module 3: Incident Reporting Test Suite', () => {
  let userAToken = null;
  let userAId = null;
  let userBToken = null;
  let userBId = null;
  let createdIncidentId = null;

  const testSuffix = Date.now();

  before(async () => {
    // Isolate incidents table
    await db.query('DELETE FROM incidents');
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%inc%']);

    // 1. Create User A (Reporter 1)
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'Aniket Rane',
        email: `aniket.inc.${testSuffix}@example.com`,
        mobile_number: '+919844444444',
        password: 'Password@123',
        confirm_password: 'Password@123',
      });
    userAId = resA.body.data.user.id;
    await request(app).post('/api/auth/verify-email').send({ email: `aniket.inc.${testSuffix}@example.com`, otp: resA.body.data.dev_email_otp });
    await request(app).post('/api/auth/verify-mobile').send({ mobile_number: '+919844444444', otp: resA.body.data.dev_mobile_otp });

    const loginA = await request(app).post('/api/auth/login').send({
      email: `aniket.inc.${testSuffix}@example.com`,
      password: 'Password@123',
    });
    userAToken = loginA.body.data.token;

    // 2. Create User B (Reporter 2 - for cross-user authorization tests)
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        full_name: 'Sneha Sawant',
        email: `sneha.inc.${testSuffix}@example.com`,
        mobile_number: '+919855555555',
        password: 'Password@123',
        confirm_password: 'Password@123',
      });
    userBId = resB.body.data.user.id;
    await request(app).post('/api/auth/verify-email').send({ email: `sneha.inc.${testSuffix}@example.com`, otp: resB.body.data.dev_email_otp });
    await request(app).post('/api/auth/verify-mobile').send({ mobile_number: '+919855555555', otp: resB.body.data.dev_mobile_otp });

    const loginB = await request(app).post('/api/auth/login').send({
      email: `sneha.inc.${testSuffix}@example.com`,
      password: 'Password@123',
    });
    userBToken = loginB.body.data.token;
  });

  after(async () => {
    // Cleanup test users and cascade incidents
    if (userAId || userBId) {
      await db.query('DELETE FROM users WHERE id IN ($1, $2)', [userAId, userBId]);
    }
  });

  describe('1. Incident Creation Validation & Authentication', () => {
    test('Test 1: should reject incident creation without authentication (401)', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .send({
          category: 'ACCIDENT',
          title: 'Road accident near bus stand',
          description: 'Two motorcycles collided near the bus station.',
          severity: 'HIGH',
          latitude: 16.9944,
          longitude: 73.3000,
        });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 2: should reject missing category (400)', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Road accident near bus stand',
          description: 'Two motorcycles collided near the bus station.',
          severity: 'HIGH',
          latitude: 16.9944,
          longitude: 73.3000,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 3: should reject arbitrary/invalid category (400)', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'ALIEN_INVASION',
          title: 'Unusual sighting',
          description: 'Something in the sky near market area.',
          severity: 'LOW',
          latitude: 16.9944,
          longitude: 73.3000,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 4: should reject missing title or title too short (400)', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'ROAD_HAZARD',
          title: 'AB',
          description: 'Large pothole in the middle of main road.',
          severity: 'MEDIUM',
          latitude: 16.9944,
          longitude: 73.3000,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 5: should reject title exceeding 120 characters (400)', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'ROAD_HAZARD',
          title: 'A'.repeat(125),
          description: 'Large pothole in the middle of main road.',
          severity: 'MEDIUM',
          latitude: 16.9944,
          longitude: 73.3000,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 6: should reject description shorter than 10 characters (400)', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'FIRE',
          title: 'Small garbage fire',
          description: 'Fire here',
          severity: 'LOW',
          latitude: 16.9944,
          longitude: 73.3000,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 7: should reject description exceeding 2000 characters (400)', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'FIRE',
          title: 'Small garbage fire',
          description: 'A'.repeat(2005),
          severity: 'LOW',
          latitude: 16.9944,
          longitude: 73.3000,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 8: should reject invalid severity level (400)', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'FIRE',
          title: 'Small garbage fire near shop',
          description: 'Dry leaves caught fire behind the market shop.',
          severity: 'EXTREME_APOCALYPSE',
          latitude: 16.9944,
          longitude: 73.3000,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 9: should reject invalid coordinates (400)', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'FIRE',
          title: 'Small garbage fire near shop',
          description: 'Dry leaves caught fire behind the market shop.',
          severity: 'LOW',
          latitude: 95.0,
          longitude: 73.3000,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  describe('2. Incident Creation & PostGIS Storage (POST /api/incidents)', () => {
    test('Test 10: should successfully create incident with valid payload in PENDING state (201)', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'ACCIDENT',
          title: 'Road collision near Maruti Mandir circle',
          description: 'Two two-wheelers collided at the roundabout. Traffic is moving slowly.',
          severity: 'HIGH',
          latitude: 16.9912,
          longitude: 73.3105,
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.strictEqual(res.body.data.reporter_id, userAId);
      assert.strictEqual(res.body.data.category, 'ACCIDENT');
      assert.strictEqual(res.body.data.title, 'Road collision near Maruti Mandir circle');
      assert.strictEqual(res.body.data.severity, 'HIGH');
      assert.strictEqual(res.body.data.status, 'PENDING');
      assert.strictEqual(res.body.data.latitude, 16.9912);
      assert.strictEqual(res.body.data.longitude, 73.3105);

      createdIncidentId = res.body.data.id;

      // Verify PostGIS geometry column in DB
      const dbCheck = await db.query(
        'SELECT ST_AsText(geom::geometry) as geom_text, status FROM incidents WHERE id = $1',
        [createdIncidentId]
      );
      assert.strictEqual(dbCheck.rows.length, 1);
      assert.strictEqual(dbCheck.rows[0].status, 'PENDING');
      assert.ok(dbCheck.rows[0].geom_text.startsWith('POINT(73.3105 16.9912)'));
    });
  });

  describe('3. My Reports & Incident Details (GET /api/incidents/my, GET /api/incidents/:id)', () => {
    test('Test 11: should list reported incidents for authenticated user', async () => {
      const res = await request(app)
        .get('/api/incidents/my')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.reports.length >= 1);
      const found = res.body.data.reports.find((i) => i.id === createdIncidentId);
      assert.ok(found, 'Created incident should be present in my reports');
      assert.strictEqual(found.title, 'Road collision near Maruti Mandir circle');
    });

    test('Test 12: User B should see 0 reports in their own my reports list', async () => {
      const res = await request(app)
        .get('/api/incidents/my')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.reports.length, 0);
    });

    test('Test 13: Reporter can view their own incident details by ID (200)', async () => {
      const res = await request(app)
        .get(`/api/incidents/${createdIncidentId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.id, createdIncidentId);
      assert.strictEqual(res.body.data.title, 'Road collision near Maruti Mandir circle');
    });

    test('Test 14: Another user cannot view someone else\'s incident details (403 forbidden)', async () => {
      const res = await request(app)
        .get(`/api/incidents/${createdIncidentId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 15: Non-existent incident ID returns 404', async () => {
      const res = await request(app)
        .get('/api/incidents/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
    });
  });

  describe('4. Incident Editing (PATCH /api/incidents/:id)', () => {
    test('Test 16: Reporter can edit their own pending incident (200)', async () => {
      const res = await request(app)
        .patch(`/api/incidents/${createdIncidentId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Updated: Major collision near Maruti Mandir',
          description: 'Two two-wheelers collided. Police and ambulance have arrived on scene.',
          severity: 'CRITICAL',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.title, 'Updated: Major collision near Maruti Mandir');
      assert.strictEqual(res.body.data.severity, 'CRITICAL');
    });

    test('Test 17: User cannot edit another user\'s incident (403)', async () => {
      const res = await request(app)
        .patch(`/api/incidents/${createdIncidentId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          title: 'Unauthorized edit attempt',
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 18: Rejects attempts to change system fields like status or reporter_id (400)', async () => {
      const res = await request(app)
        .patch(`/api/incidents/${createdIncidentId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          status: 'RESOLVED',
          reporter_id: userBId,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  describe('5. Incident Cancellation (PATCH /api/incidents/:id/cancel)', () => {
    test('Test 19: User cannot cancel another user\'s incident (403)', async () => {
      const res = await request(app)
        .patch(`/api/incidents/${createdIncidentId}/cancel`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 20: Reporter can cancel their own incident report (200, status CANCELLED)', async () => {
      const res = await request(app)
        .patch(`/api/incidents/${createdIncidentId}/cancel`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'CANCELLED');

      // Verify DB record is preserved for audit trail
      const dbCheck = await db.query('SELECT status FROM incidents WHERE id = $1', [createdIncidentId]);
      assert.strictEqual(dbCheck.rows[0].status, 'CANCELLED');
    });

    test('Test 21: Cannot edit an already CANCELLED incident (400)', async () => {
      const res = await request(app)
        .patch(`/api/incidents/${createdIncidentId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Trying to edit cancelled incident',
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  describe('6. Evidence Photo Upload Validation', () => {
    const tempDir = path.join(__dirname, 'temp_test_files');
    const validPng = path.join(tempDir, 'valid_evidence.png');
    const invalidTxt = path.join(tempDir, 'malicious_script.txt');
    const largeJpg = path.join(tempDir, 'huge_image.jpg');

    before(() => {
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      // Create small valid dummy PNG (1x1 transparent png bytes)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);
      fs.writeFileSync(validPng, pngBuffer);
      fs.writeFileSync(invalidTxt, 'echo "malicious payload"');
      // Create 5.5MB dummy file
      const bigBuffer = Buffer.alloc(5.5 * 1024 * 1024);
      fs.writeFileSync(largeJpg, bigBuffer);
    });

    after(() => {
      try {
        if (fs.existsSync(validPng)) fs.unlinkSync(validPng);
        if (fs.existsSync(invalidTxt)) fs.unlinkSync(invalidTxt);
        if (fs.existsSync(largeJpg)) fs.unlinkSync(largeJpg);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
      } catch (e) {}
    });

    test('Test 22: should reject unsupported file type (.txt) with 415', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('category', 'ROAD_HAZARD')
        .field('title', 'Hazard on highway')
        .field('description', 'Fallen tree blocking lane on highway.')
        .field('severity', 'HIGH')
        .field('latitude', '16.9944')
        .field('longitude', '73.3000')
        .attach('image', invalidTxt);

      assert.strictEqual(res.status, 415);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Unsupported file type'));
    });

    test('Test 23: should reject oversized image (> 5MB) with 413', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('category', 'ROAD_HAZARD')
        .field('title', 'Hazard on highway')
        .field('description', 'Fallen tree blocking lane on highway.')
        .field('severity', 'HIGH')
        .field('latitude', '16.9944')
        .field('longitude', '73.3000')
        .attach('image', largeJpg);

      assert.strictEqual(res.status, 413);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('exceeds the 5MB limit'));
    });

    test('Test 24: should successfully upload and attach valid PNG evidence photo', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('category', 'ROAD_HAZARD')
        .field('title', 'Fallen tree on Shivaji Nagar road')
        .field('description', 'Large branch blocking the left lane near the petrol pump.')
        .field('severity', 'MEDIUM')
        .field('latitude', '16.9902')
        .field('longitude', '73.3120')
        .attach('image', validPng);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.image_url);
      assert.ok(res.body.data.image_url.startsWith('/uploads/incidents/'));
    });
  });

  // -------------------------------------------------------------
  // MAP-BASED ACTIVE INCIDENT VISUALIZATION TESTS (GET /api/incidents/nearby)
  // -------------------------------------------------------------
  describe('7. Map-Based Active Incident Visualization (GET /api/incidents/nearby)', () => {
    let activeAccidentId = null;

    before(async () => {
      // Create a fresh active accident report by User A at Shivaji Nagar (16.9902, 73.3120)
      const accidentRes = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'ACCIDENT',
          title: 'Car collision near Shivaji Nagar Signal',
          description: 'Two cars collided at the intersection. Traffic is slowed down.',
          severity: 'HIGH',
          latitude: 16.9902,
          longitude: 73.3120,
        });
      assert.strictEqual(accidentRes.status, 201);
      activeAccidentId = accidentRes.body.data.id;
    });

    test('Test 25: User B within the radius gets User A active incident on GET /api/incidents/nearby', async () => {
      // User B is at Mandvi (~2.9 km away) -> query with 5 km radius
      const res = await request(app)
        .get('/api/incidents/nearby?latitude=16.9850&longitude=73.2850&radius=5000')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.incidents));
      
      const found = res.body.data.incidents.find((i) => i.id === activeAccidentId);
      assert.ok(found, 'User B should see User A active incident');
      assert.strictEqual(found.category, 'ACCIDENT');
      assert.strictEqual(found.title, 'Car collision near Shivaji Nagar Signal');
      assert.strictEqual(found.severity, 'HIGH');
      assert.strictEqual(found.status, 'PENDING');
      assert.ok(found.latitude);
      assert.ok(found.longitude);
      assert.ok(found.distance_meters > 0);
    });

    test('Test 26: User outside the radius does NOT see User A incident', async () => {
      // Query from Mumbai (~230 km away from Ratnagiri) -> query with 5 km radius
      const res = await request(app)
        .get('/api/incidents/nearby?latitude=19.0760&longitude=72.8777&radius=5000')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      const found = res.body.data.incidents.find((i) => i.id === activeAccidentId);
      assert.strictEqual(found, undefined, 'User should NOT see incident outside radius');
    });

    test('Test 27: Strict Privacy - Nearby query must NEVER leak reporter identity or private coordinates', async () => {
      const res = await request(app)
        .get('/api/incidents/nearby?latitude=16.9902&longitude=73.3120&radius=2000')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.incidents.length > 0);

      for (const inc of res.body.data.incidents) {
        assert.strictEqual(inc.reporter_id, undefined);
        assert.strictEqual(inc.reporter_name, undefined);
        assert.strictEqual(inc.reporter_email, undefined);
        assert.strictEqual(inc.reporter_phone, undefined);
        assert.strictEqual(inc.password, undefined);
        assert.strictEqual(inc.password_hash, undefined);
      }
    });

    test('Test 28: Cancelled incident does not appear on nearby incident map', async () => {
      // Create and cancel an incident
      const incRes = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'SUSPICIOUS_ACTIVITY',
          title: 'Temporary Suspicious Activity',
          description: 'Suspicious vehicle parked in alley.',
          severity: 'LOW',
          latitude: 16.9902,
          longitude: 73.3120,
        });
      const tempId = incRes.body.data.id;

      // Cancel it
      await request(app)
        .patch(`/api/incidents/${tempId}/cancel`)
        .set('Authorization', `Bearer ${userAToken}`);

      // Query nearby
      const res = await request(app)
        .get('/api/incidents/nearby?latitude=16.9902&longitude=73.3120&radius=2000')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 200);
      const found = res.body.data.incidents.find((i) => i.id === tempId);
      assert.strictEqual(found, undefined, 'Cancelled incident must not appear on map');
    });

    test('Test 29: Category & Severity filter support on GET /api/incidents/nearby', async () => {
      const accidentOnlyRes = await request(app)
        .get('/api/incidents/nearby?latitude=16.9902&longitude=73.3120&radius=5000&category=ACCIDENT')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(accidentOnlyRes.status, 200);
      for (const inc of accidentOnlyRes.body.data.incidents) {
        assert.strictEqual(inc.category, 'ACCIDENT');
      }
    });
  });
});
