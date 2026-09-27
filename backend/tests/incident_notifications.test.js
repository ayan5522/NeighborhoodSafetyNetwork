const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const notificationService = require('../src/services/notificationService');

describe('Module 7: Step 2 — Incident -> Nearby Users -> Notification Creation Test Suite', () => {
  let userAToken = null;
  let userAId = null;
  let userBToken = null;
  let userBId = null;
  let userCToken = null;
  let userCId = null;
  let userDToken = null;
  let userDId = null;

  let incident1Id = null;
  let incident2Id = null;

  const testSuffix = Date.now();

  before(async () => {
    // 1. Clean up notifications, alerts, and isolated test data
    await db.query('DELETE FROM notifications');
    await db.query('DELETE FROM alerts');
    await db.query('DELETE FROM incident_verifications');
    await db.query('DELETE FROM incidents WHERE title LIKE $1', ['%Notif Integration%']);
    await db.query('DELETE FROM user_locations');
    await db.query("DELETE FROM users WHERE email LIKE '%notif.step2%'");

    // Helper to register and login user
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

    // Helper to generate a unique valid Indian mobile number
    const genMobile = () => `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;

    // User A: Incident Reporter (Shivaji Nagar, Ratnagiri)
    const userA = await registerAndLogin(
      'Reporter User A',
      `userA.notif.step2.${testSuffix}@example.com`,
      genMobile()
    );
    userAId = userA.userId;
    userAToken = userA.token;

    // Set User A Location (16.9902, 73.3120)
    await request(app)
      .post('/api/location')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ latitude: 16.9902, longitude: 73.3120, accuracy: 5 });

    // User B: Nearby Resident (~1.2 km away in Ratnagiri: 16.9950, 73.3050)
    const userB = await registerAndLogin(
      'Resident User B',
      `userB.notif.step2.${testSuffix}@example.com`,
      genMobile()
    );
    userBId = userB.userId;
    userBToken = userB.token;

    // Set User B Location
    await request(app)
      .post('/api/location')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ latitude: 16.9950, longitude: 73.3050, accuracy: 10 });

    // User C: Distant Resident (Mumbai, ~230 km away: 19.0760, 72.8777)
    const userC = await registerAndLogin(
      'Resident User C Mumbai',
      `userC.notif.step2.${testSuffix}@example.com`,
      genMobile()
    );
    userCId = userC.userId;
    userCToken = userC.token;

    // Set User C Location
    await request(app)
      .post('/api/location')
      .set('Authorization', `Bearer ${userCToken}`)
      .send({ latitude: 19.0760, longitude: 72.8777, accuracy: 15 });

    // User D: Resident with NO location data registered
    const userD = await registerAndLogin(
      'Resident User D No Location',
      `userD.notif.step2.${testSuffix}@example.com`,
      genMobile()
    );
    userDId = userD.userId;
    userDToken = userD.token;
  });

  after(async () => {
    // Cleanup
    await db.query('DELETE FROM notifications');
    await db.query('DELETE FROM alerts');
    await db.query('DELETE FROM incident_verifications');
    if (userAId || userBId || userCId || userDId) {
      await db.query('DELETE FROM incidents WHERE reporter_id IN ($1, $2, $3, $4)', [
        userAId || '00000000-0000-0000-0000-000000000000',
        userBId || '00000000-0000-0000-0000-000000000000',
        userCId || '00000000-0000-0000-0000-000000000000',
        userDId || '00000000-0000-0000-0000-000000000000',
      ]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4)', [
        userAId || '00000000-0000-0000-0000-000000000000',
        userBId || '00000000-0000-0000-0000-000000000000',
        userCId || '00000000-0000-0000-0000-000000000000',
        userDId || '00000000-0000-0000-0000-000000000000',
      ]);
    }
  });

  // =========================================================================
  // TEST 1: User A creates Incident 1 -> User B receives 1 notification, User A gets 0
  // =========================================================================
  test('TEST 1: User A creates Incident 1 (HIGH) -> User B gets INCIDENT_NEARBY notification, User A gets 0', async () => {
    const incRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        category: 'ACCIDENT',
        title: 'Notif Integration Incident 1 - Collided Vehicles',
        description: 'Two vehicles collided on coastal road. Police alerted.',
        severity: 'HIGH', // 3000m radius
        latitude: 16.9902,
        longitude: 73.3120,
      });

    assert.strictEqual(incRes.status, 201);
    assert.strictEqual(incRes.body.success, true);
    incident1Id = incRes.body.data.id;

    // Check User B notification feed
    const notifsB = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(notifsB.status, 200);
    assert.strictEqual(notifsB.body.success, true);
    assert.strictEqual(notifsB.body.data.length, 1);
    const n = notifsB.body.data[0];
    assert.strictEqual(n.type, 'INCIDENT_NEARBY');
    assert.strictEqual(n.incident_id, incident1Id);
    assert.strictEqual(n.is_read, false);
    assert.strictEqual(n.user_id, userBId);
    assert.ok(n.alert_id, 'alert_id should be linked if an alert was generated');

    // Check User A (Reporter) notification feed -> Must be 0 (No self-notification)
    const notifsA = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userAToken}`);

    assert.strictEqual(notifsA.status, 200);
    assert.strictEqual(notifsA.body.data.length, 0, 'Reporter must not receive notification for their own incident');
  });

  // =========================================================================
  // TEST 2: User C (Mumbai) is outside radius -> Does NOT receive notification
  // =========================================================================
  test('TEST 2: User C (Mumbai, ~230 km away) is outside the radius and receives 0 notifications', async () => {
    const notifsC = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userCToken}`);

    assert.strictEqual(notifsC.status, 200);
    assert.strictEqual(notifsC.body.data.length, 0, 'User outside radius must not receive any notification');

    const unreadC = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${userCToken}`);

    assert.strictEqual(unreadC.status, 200);
    assert.strictEqual(unreadC.body.data.unread_count, 0);
  });

  // =========================================================================
  // TEST 3: Duplicate prevention on same incident
  // =========================================================================
  test('TEST 3: Duplicate prevention - Re-processing same incident does not create duplicate notifications', async () => {
    // Re-invoke generateIncidentNearbyNotifications for Incident 1
    const duplicateRun = await notificationService.generateIncidentNearbyNotifications({
      id: incident1Id,
      category: 'ACCIDENT',
      title: 'Notif Integration Incident 1 - Collided Vehicles',
      severity: 'HIGH',
      latitude: 16.9902,
      longitude: 73.3120,
      reporter_id: userAId,
    });

    assert.strictEqual(duplicateRun.generatedCount, 0, 'Zero duplicate notifications inserted');

    // Verify User B still has exactly 1 notification
    const notifsB = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(notifsB.body.data.length, 1);
  });

  // =========================================================================
  // TEST 4: Different incidents create separate notifications for User B
  // =========================================================================
  test('TEST 4: Different incidents - User A creates Incident 2 -> User B has notifications for both incidents', async () => {
    const inc2Res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        category: 'FIRE',
        title: 'Notif Integration Incident 2 - Shop Fire',
        description: 'Smoke coming from shop near signal.',
        severity: 'CRITICAL', // 5000m radius
        latitude: 16.9910,
        longitude: 73.3130,
      });

    assert.strictEqual(inc2Res.status, 201);
    incident2Id = inc2Res.body.data.id;

    // User B should now have 2 notifications
    const notifsB = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(notifsB.body.data.length, 2);
    const incidentIds = notifsB.body.data.map((n) => n.incident_id);
    assert.ok(incidentIds.includes(incident1Id));
    assert.ok(incidentIds.includes(incident2Id));
  });

  // =========================================================================
  // TEST 5: Different severity / radius rules
  // =========================================================================
  describe('TEST 5: Severity and Radius Rules Enforcement', () => {
    let mandviResidentToken = null;
    let mandviResidentId = null;

    before(async () => {
      // Create a resident in Mandvi Beach (~2.9 km away from Shivaji Nagar: 16.9850, 73.2850)
      const mandviMobile = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
      const mandviUser = await (async () => {
        const regRes = await request(app).post('/api/auth/register').send({
          full_name: 'Mandvi Resident',
          email: `mandvi.notif.step2.${testSuffix}@example.com`,
          mobile_number: mandviMobile,
          password: 'Password@123',
          confirm_password: 'Password@123',
        });
        const userId = regRes.body.data.user.id;
        await request(app).post('/api/auth/verify-email').send({
          email: `mandvi.notif.step2.${testSuffix}@example.com`,
          otp: regRes.body.data.dev_email_otp,
        });
        await request(app).post('/api/auth/verify-mobile').send({
          mobile_number: mandviMobile,
          otp: regRes.body.data.dev_mobile_otp,
        });
        const loginRes = await request(app).post('/api/auth/login').send({
          email: `mandvi.notif.step2.${testSuffix}@example.com`,
          password: 'Password@123',
        });
        return { userId, token: loginRes.body.data.token };
      })();

      mandviResidentId = mandviUser.userId;
      mandviResidentToken = mandviUser.token;

      // Set Mandvi location (~2.9 km away)
      await request(app)
        .post('/api/location')
        .set('Authorization', `Bearer ${mandviResidentToken}`)
        .send({ latitude: 16.9850, longitude: 73.2850, accuracy: 5 });
    });

    after(async () => {
      if (mandviResidentId) {
        await db.query('DELETE FROM users WHERE id = $1', [mandviResidentId]);
      }
    });

    test('LOW incident (1 km radius) excludes Mandvi resident (~2.9 km away)', async () => {
      const lowInc = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'ROAD_HAZARD',
          title: 'Notif Integration - Pothole on Local Lane',
          description: 'Small pothole near neighborhood entrance.',
          severity: 'LOW', // 1000m radius
          latitude: 16.9902,
          longitude: 73.3120,
        });
      assert.strictEqual(lowInc.status, 201);
      const lowIncId = lowInc.body.data.id;

      // Mandvi resident should NOT have received a notification for 1km LOW incident
      const notifsMandvi = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${mandviResidentToken}`);

      const found = notifsMandvi.body.data.find((n) => n.incident_id === lowIncId);
      assert.strictEqual(found, undefined, 'Mandvi resident (~2.9km) must be excluded from 1km LOW incident');
    });

    test('HIGH incident (3 km radius) includes Mandvi resident (~2.9 km away)', async () => {
      const highInc = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          category: 'ACCIDENT',
          title: 'Notif Integration - Major Bypass Collision',
          description: 'Truck overturned on main highway.',
          severity: 'HIGH', // 3000m radius
          latitude: 16.9902,
          longitude: 73.3120,
        });
      assert.strictEqual(highInc.status, 201);
      const highIncId = highInc.body.data.id;

      // Mandvi resident SHOULD receive notification for 3km HIGH incident
      const notifsMandvi = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${mandviResidentToken}`);

      const found = notifsMandvi.body.data.find((n) => n.incident_id === highIncId);
      assert.ok(found, 'Mandvi resident (~2.9km) must receive notification for 3km HIGH incident');
      assert.strictEqual(found.type, 'INCIDENT_NEARBY');
    });
  });

  // =========================================================================
  // TEST 6: User with NO location record receives 0 notifications
  // =========================================================================
  test('TEST 6: User D (with no registered location) does NOT receive nearby notifications', async () => {
    const notifsD = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userDToken}`);

    assert.strictEqual(notifsD.status, 200);
    assert.strictEqual(notifsD.body.data.length, 0, 'User without location data must receive 0 notifications');
  });

  // =========================================================================
  // TEST 7: Reporter NEVER receives self-notification
  // =========================================================================
  test('TEST 7: Incident reporter User A never receives self-notification for any of their reports', async () => {
    const notifsA = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userAToken}`);

    assert.strictEqual(notifsA.status, 200);
    assert.strictEqual(notifsA.body.data.length, 0);

    const countA = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${userAToken}`);

    assert.strictEqual(countA.body.data.unread_count, 0);
  });

  // =========================================================================
  // TEST 8: Notification API verification (GET /api/notifications and unread-count)
  // =========================================================================
  test('TEST 8: Notification APIs reflect generated notifications and unread-count correctly', async () => {
    // User B unread count should match their unread notifications
    const unreadB = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(unreadB.status, 200);
    assert.ok(unreadB.body.data.unread_count >= 2);

    // Mark one notification as read
    const notifsB = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userBToken}`);

    const firstNotifId = notifsB.body.data[0].id;
    const initialUnreadCount = unreadB.body.data.unread_count;

    const readRes = await request(app)
      .patch(`/api/notifications/${firstNotifId}/read`)
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(readRes.status, 200);
    assert.strictEqual(readRes.body.data.is_read, true);

    // Unread count should now be decremented by 1
    const unreadAfter = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(unreadAfter.body.data.unread_count, initialUnreadCount - 1);
  });

  // =========================================================================
  // TEST 9: Privacy Compliance — No reporter private information in notification
  // =========================================================================
  test('TEST 9: Privacy Compliance — Notification title and message never leak reporter email, phone, or secrets', async () => {
    const notifsB = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userBToken}`);

    for (const notif of notifsB.body.data) {
      assert.strictEqual(notif.reporter_email, undefined);
      assert.strictEqual(notif.reporter_phone, undefined);
      assert.strictEqual(notif.reporter_name, undefined);

      const jsonStr = JSON.stringify(notif);
      assert.strictEqual(jsonStr.includes('+919811111111'), false, 'Must not leak reporter mobile');
      assert.strictEqual(jsonStr.includes('userA.notif.step2'), false, 'Must not leak reporter email');
      assert.strictEqual(jsonStr.includes('Password'), false, 'Must not leak passwords');
    }
  });
});
