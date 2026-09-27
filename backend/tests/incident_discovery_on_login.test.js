const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

describe('Bug Verification: Existing Incidents Visibility for Newly Logged-In User', () => {
  let userAToken = null;
  let userAId = null;
  let userBToken = null;
  let userBId = null;
  let userCToken = null;
  let userCId = null;

  let incident1Id = null;
  let incident2Id = null;

  const testSuffix = Date.now();

  before(async () => {
    // 1. Isolate test tables
    await db.query('DELETE FROM alerts');
    await db.query('DELETE FROM notifications');
    await db.query('DELETE FROM incident_verifications');
    await db.query('DELETE FROM incidents');
    await db.query('DELETE FROM user_locations');
    await db.query("DELETE FROM users WHERE email LIKE '%discovery%'");

    // Helper to register, verify and login user
    async function registerAndLogin(name, email, mobile) {
      const regRes = await request(app).post('/api/auth/register').send({
        full_name: name,
        email,
        mobile_number: mobile,
        password: 'Password@123',
        confirm_password: 'Password@123',
      });
      const userId = regRes.body.data.user.id;

      await request(app).post('/api/auth/verify-email').send({
        email,
        otp: regRes.body.data.dev_email_otp,
      });
      await request(app).post('/api/auth/verify-mobile').send({
        mobile_number: mobile,
        otp: regRes.body.data.dev_mobile_otp,
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email,
        password: 'Password@123',
      });

      return { userId, token: loginRes.body.data.token };
    }

    // Helper to generate unique mobile number
    const genMobile = () => `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;

    // Step A: User A registers and logs in (Reporter in Shivaji Nagar, Ratnagiri)
    const userA = await registerAndLogin(
      'Reporter User A',
      `userA.discovery.${testSuffix}@example.com`,
      genMobile()
    );
    userAId = userA.userId;
    userAToken = userA.token;

    // Set User A Location (16.9902, 73.3120)
    await request(app)
      .post('/api/location')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ latitude: 16.9902, longitude: 73.3120, accuracy: 5 });

    // Step B: User A creates Incident 1 BEFORE User B even logs in or registers location
    const inc1Res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        category: 'ACCIDENT',
        title: 'Discovery Test Incident 1 - Vehicle Collision',
        description: 'Road blocked near main square.',
        severity: 'HIGH', // 3000m radius
        latitude: 16.9902,
        longitude: 73.3120,
      });
    assert.strictEqual(inc1Res.status, 201);
    incident1Id = inc1Res.body.data.id;
  });

  after(async () => {
    // Cleanup
    await db.query('DELETE FROM alerts');
    await db.query('DELETE FROM incident_verifications');
    if (userAId || userBId || userCId) {
      await db.query('DELETE FROM incidents WHERE reporter_id IN ($1, $2, $3)', [
        userAId || '00000000-0000-0000-0000-000000000000',
        userBId || '00000000-0000-0000-0000-000000000000',
        userCId || '00000000-0000-0000-0000-000000000000',
      ]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [
        userAId || '00000000-0000-0000-0000-000000000000',
        userBId || '00000000-0000-0000-0000-000000000000',
        userCId || '00000000-0000-0000-0000-000000000000',
      ]);
    }
  });

  test('Step 1: User B logs in for the first time and syncs location (~1.2 km away in Ratnagiri)', async () => {
    const userBMobile = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
    // Register User B
    const regRes = await request(app).post('/api/auth/register').send({
      full_name: 'Resident User B',
      email: `userB.discovery.${testSuffix}@example.com`,
      mobile_number: userBMobile,
      password: 'Password@123',
      confirm_password: 'Password@123',
    });
    userBId = regRes.body.data.user.id;
    await request(app).post('/api/auth/verify-email').send({
      email: `userB.discovery.${testSuffix}@example.com`,
      otp: regRes.body.data.dev_email_otp,
    });
    await request(app).post('/api/auth/verify-mobile').send({
      mobile_number: userBMobile,
      otp: regRes.body.data.dev_mobile_otp,
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: `userB.discovery.${testSuffix}@example.com`,
      password: 'Password@123',
    });
    userBToken = loginRes.body.data.token;

    // Simulate mobile app login flow: HomeScreen immediately syncs current GPS coordinates (16.9950, 73.3050)
    const locRes = await request(app)
      .post('/api/location')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ latitude: 16.9950, longitude: 73.3050, accuracy: 10 });
    assert.strictEqual(locRes.status, 200);
  });

  test('Step 2: User B immediately sees preexisting Incident 1 in Alerts feed and unread count', async () => {
    // Check Alerts Feed
    const alertsRes = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(alertsRes.status, 200);
    assert.strictEqual(alertsRes.body.success, true);
    assert.ok(Array.isArray(alertsRes.body.data));
    assert.strictEqual(alertsRes.body.data.length, 1, 'Preexisting Incident 1 must be present in User B alert feed');
    assert.strictEqual(alertsRes.body.data[0].incident_id, incident1Id);
    assert.strictEqual(alertsRes.body.data[0].priority, 'HIGH');
    assert.strictEqual(alertsRes.body.data[0].status, 'ACTIVE');

    // Check Unread Count
    const unreadRes = await request(app)
      .get('/api/alerts/unread-count')
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(unreadRes.status, 200);
    assert.strictEqual(unreadRes.body.data.unread_count, 1);
  });

  test('Step 3: User B sees preexisting Incident 1 on Neighborhood Map (GET /api/incidents/nearby)', async () => {
    const mapRes = await request(app)
      .get('/api/incidents/nearby?latitude=16.9950&longitude=73.3050&radius=5000')
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(mapRes.status, 200);
    assert.strictEqual(mapRes.body.success, true);
    assert.ok(Array.isArray(mapRes.body.data.incidents));
    assert.strictEqual(mapRes.body.data.incidents.length, 1);
    assert.strictEqual(mapRes.body.data.incidents[0].id, incident1Id);
    assert.strictEqual(mapRes.body.data.incidents[0].title, 'Discovery Test Incident 1 - Vehicle Collision');
  });

  test('Step 4: User A creates Incident 2 (CRITICAL) -> User B now sees BOTH Incident 1 AND Incident 2', async () => {
    // User A creates Incident 2
    const inc2Res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        category: 'FIRE',
        title: 'Discovery Test Incident 2 - Structural Fire',
        description: 'Fire brigade on the way.',
        severity: 'CRITICAL',
        latitude: 16.9910,
        longitude: 73.3130,
      });
    assert.strictEqual(inc2Res.status, 201);
    incident2Id = inc2Res.body.data.id;

    // User B checks Alerts Feed -> Must have 2 alerts
    const alertsRes = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(alertsRes.status, 200);
    assert.strictEqual(alertsRes.body.data.length, 2, 'User B must see both Incident 1 AND Incident 2');
    const incidentIds = alertsRes.body.data.map((a) => a.incident_id);
    assert.ok(incidentIds.includes(incident1Id), 'Incident 1 must be present');
    assert.ok(incidentIds.includes(incident2Id), 'Incident 2 must be present');

    // User B checks Neighborhood Map -> Must have 2 incidents
    const mapRes = await request(app)
      .get('/api/incidents/nearby?latitude=16.9950&longitude=73.3050&radius=5000')
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(mapRes.status, 200);
    assert.strictEqual(mapRes.body.data.incidents.length, 2);
  });

  test('Step 5: User C registers and logs in from Mumbai (~230 km away) -> Excluded from all Ratnagiri alerts/incidents', async () => {
    const userCMobile = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
    // Register User C
    const regRes = await request(app).post('/api/auth/register').send({
      full_name: 'Resident User C Mumbai',
      email: `userC.discovery.${testSuffix}@example.com`,
      mobile_number: userCMobile,
      password: 'Password@123',
      confirm_password: 'Password@123',
    });
    userCId = regRes.body.data.user.id;
    await request(app).post('/api/auth/verify-email').send({
      email: `userC.discovery.${testSuffix}@example.com`,
      otp: regRes.body.data.dev_email_otp,
    });
    await request(app).post('/api/auth/verify-mobile').send({
      mobile_number: userCMobile,
      otp: regRes.body.data.dev_mobile_otp,
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: `userC.discovery.${testSuffix}@example.com`,
      password: 'Password@123',
    });
    userCToken = loginRes.body.data.token;

    // User C syncs Mumbai location (19.0760, 72.8777)
    await request(app)
      .post('/api/location')
      .set('Authorization', `Bearer ${userCToken}`)
      .send({ latitude: 19.0760, longitude: 72.8777, accuracy: 10 });

    // User C checks Alerts Feed -> Must be 0
    const alertsRes = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${userCToken}`);

    assert.strictEqual(alertsRes.status, 200);
    assert.strictEqual(alertsRes.body.data.length, 0, 'User C in Mumbai must receive 0 alerts for Ratnagiri incidents');

    // User C checks Neighborhood Map around Mumbai -> Must be 0
    const mapRes = await request(app)
      .get('/api/incidents/nearby?latitude=19.0760&longitude=72.8777&radius=5000')
      .set('Authorization', `Bearer ${userCToken}`);

    assert.strictEqual(mapRes.status, 200);
    assert.strictEqual(mapRes.body.data.incidents.length, 0, 'User C must see 0 nearby incidents');
  });

  test('Step 6: User A cancels Incident 1 -> Immediately removed from active map and resolved in alerts', async () => {
    // User A cancels Incident 1
    const cancelRes = await request(app)
      .patch(`/api/incidents/${incident1Id}/cancel`)
      .set('Authorization', `Bearer ${userAToken}`);
    assert.strictEqual(cancelRes.status, 200);

    // Map query should now return ONLY Incident 2 (Incident 1 is excluded)
    const mapRes = await request(app)
      .get('/api/incidents/nearby?latitude=16.9950&longitude=73.3050&radius=5000')
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(mapRes.status, 200);
    assert.strictEqual(mapRes.body.data.incidents.length, 1);
    assert.strictEqual(mapRes.body.data.incidents[0].id, incident2Id);
  });
});
