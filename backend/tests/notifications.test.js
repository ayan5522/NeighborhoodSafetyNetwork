const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const notificationService = require('../src/services/notificationService');
const { NOTIFICATION_TYPES } = require('../src/constants/notificationTypes');

describe('Module 7: Step 1 — Notification Architecture & Database Test Suite', () => {
  let userAToken = null;
  let userAId = null;
  let userBToken = null;
  let userBId = null;

  let notification1AId = null;
  let notification2AId = null;
  let notificationBId = null;

  const testSuffix = Date.now();

  before(async () => {
    // 1. Clean up notifications and isolate test data
    await db.query('DELETE FROM notifications');
    await db.query("DELETE FROM users WHERE email LIKE '%notif.test%'");

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

    // User A: Primary Resident
    const userA = await registerAndLogin(
      'Resident User A',
      `userA.notif.test.${testSuffix}@example.com`,
      genMobile()
    );
    userAId = userA.userId;
    userAToken = userA.token;

    // User B: Secondary Resident
    const userB = await registerAndLogin(
      'Resident User B',
      `userB.notif.test.${testSuffix}@example.com`,
      genMobile()
    );
    userBId = userB.userId;
    userBToken = userB.token;

    // Create Initial Notification for User A (INCIDENT_NEARBY)
    const notif1 = await notificationService.createNotification({
      userId: userAId,
      type: NOTIFICATION_TYPES.INCIDENT_NEARBY,
      title: 'Active Incident in Shivaji Nagar',
      message: 'Road blockage reported 250m away from your location.',
    });
    notification1AId = notif1.id;

    // Create Second Notification for User A (COMMUNITY_VERIFICATION)
    const notif2 = await notificationService.createNotification({
      userId: userAId,
      type: NOTIFICATION_TYPES.COMMUNITY_VERIFICATION,
      title: 'Incident Verified by Neighbors',
      message: '3 community members confirmed the nearby safety hazard.',
    });
    notification2AId = notif2.id;

    // Create Notification for User B (SYSTEM)
    const notifB = await notificationService.createNotification({
      userId: userBId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: 'Welcome to Neighborhood Safety Network',
      message: 'Your account is active. Safety alerts will appear here.',
    });
    notificationBId = notifB.id;
  });

  after(async () => {
    // Cleanup
    await db.query('DELETE FROM notifications');
    if (userAId || userBId) {
      await db.query('DELETE FROM users WHERE id IN ($1, $2)', [
        userAId || '00000000-0000-0000-0000-000000000000',
        userBId || '00000000-0000-0000-0000-000000000000',
      ]);
    }
  });

  // =========================================================================
  // SECTION 1: Service Validation & Data Model Constraints
  // =========================================================================
  describe('1. Service Validation & Data Model Constraints', () => {
    test('Test 1: should reject notification creation with invalid type', async () => {
      await assert.rejects(
        async () => {
          await notificationService.createNotification({
            userId: userAId,
            type: 'INVALID_CUSTOM_TYPE',
            title: 'Test Title',
            message: 'Test Message',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /Invalid notification type/i);
          return true;
        }
      );
    });

    test('Test 2: should reject notification creation with missing title or message', async () => {
      await assert.rejects(
        async () => {
          await notificationService.createNotification({
            userId: userAId,
            type: NOTIFICATION_TYPES.ALERT_CREATED,
            title: '',
            message: 'Some message',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /Title is required/i);
          return true;
        }
      );
    });

    test('Test 3: should default is_read to false and read_at to null on creation', async () => {
      const created = await notificationService.createNotification({
        userId: userAId,
        type: NOTIFICATION_TYPES.ALERT_CREATED,
        title: 'New Safety Alert',
        message: 'High priority alert issued in your sector.',
      });

      assert.strictEqual(created.is_read, false);
      assert.strictEqual(created.read_at, null);
      assert.ok(created.id);
      assert.ok(created.created_at);
    });
  });

  // =========================================================================
  // SECTION 2: Authentication & Authorization Controls
  // =========================================================================
  describe('2. Authentication & Authorization Controls', () => {
    test('Test 4: should reject GET /api/notifications without authentication (401)', async () => {
      const res = await request(app).get('/api/notifications');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 5: should reject GET /api/notifications/unread-count without authentication (401)', async () => {
      const res = await request(app).get('/api/notifications/unread-count');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 6: User A cannot retrieve User B notifications (strict isolation)', async () => {
      const resA = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(resA.status, 200);
      assert.strictEqual(resA.body.success, true);
      assert.ok(Array.isArray(resA.body.data));

      // User A should have 3 notifications (2 from before + 1 from Test 3), NONE for User B
      const notifIdsA = resA.body.data.map((n) => n.id);
      assert.ok(notifIdsA.includes(notification1AId));
      assert.ok(notifIdsA.includes(notification2AId));
      assert.strictEqual(notifIdsA.includes(notificationBId), false, 'User A must never see User B notification');

      for (const n of resA.body.data) {
        assert.strictEqual(n.user_id, userAId);
      }
    });

    test('Test 7: User A cannot mark User B notification as read (returns 404/not found)', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${notificationBId}/read`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);

      // Verify User B notification remains unread in database
      const dbCheck = await db.query('SELECT is_read, read_at FROM notifications WHERE id = $1', [notificationBId]);
      assert.strictEqual(dbCheck.rows[0].is_read, false);
      assert.strictEqual(dbCheck.rows[0].read_at, null);
    });
  });

  // =========================================================================
  // SECTION 3: Notification Feed, Badges & Query Filters
  // =========================================================================
  describe('3. Notification Feed, Badges & Query Filters', () => {
    test('Test 8: GET /api/notifications/unread-count returns accurate count for User A and User B', async () => {
      const resA = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(resA.status, 200);
      assert.strictEqual(resA.body.success, true);
      assert.strictEqual(resA.body.data.unread_count, 3);

      const resB = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(resB.status, 200);
      assert.strictEqual(resB.body.data.unread_count, 1);
    });

    test('Test 9: GET /api/notifications supports filtering by notification type', async () => {
      const res = await request(app)
        .get('/api/notifications?type=INCIDENT_NEARBY')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].id, notification1AId);
      assert.strictEqual(res.body.data[0].type, 'INCIDENT_NEARBY');
    });

    test('Test 10: GET /api/notifications rejects invalid type filter (400)', async () => {
      const res = await request(app)
        .get('/api/notifications?type=UNKNOWN_INVALID')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  // =========================================================================
  // SECTION 4: Read State Management & Idempotency
  // =========================================================================
  describe('4. Read State Management & Idempotency', () => {
    test('Test 11: PATCH /api/notifications/:id/read marks notification as read with timestamp', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${notification1AId}/read`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.id, notification1AId);
      assert.strictEqual(res.body.data.is_read, true);
      assert.ok(res.body.data.read_at !== null);

      // Verify unread count decremented from 3 to 2
      const countRes = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userAToken}`);
      assert.strictEqual(countRes.body.data.unread_count, 2);
    });

    test('Test 12: Marking an already-read notification is idempotent and safe', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${notification1AId}/read`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.is_read, true);

      // Unread count remains 2
      const countRes = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userAToken}`);
      assert.strictEqual(countRes.body.data.unread_count, 2);
    });

    test('Test 13: PATCH /api/notifications/:id/read rejects invalid UUID format (400)', async () => {
      const res = await request(app)
        .patch('/api/notifications/invalid-uuid/read')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Test 14: PATCH /api/notifications/read-all marks all User A unread notifications as read', async () => {
      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.updated_count, 2);

      // User A unread count is now 0
      const countResA = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userAToken}`);
      assert.strictEqual(countResA.body.data.unread_count, 0);

      // User B unread count MUST still be 1 (unaffected)
      const countResB = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userBToken}`);
      assert.strictEqual(countResB.body.data.unread_count, 1);
    });
  });

  // =========================================================================
  // SECTION 5: Privacy & Leak Prevention
  // =========================================================================
  describe('5. Privacy & Leak Prevention', () => {
    test('Test 15: Notification responses must never expose passwords, phone numbers, or tokens', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userAToken}`);

      const bodyStr = JSON.stringify(res.body);
      assert.strictEqual(bodyStr.includes('password'), false);
      assert.strictEqual(bodyStr.includes('password_hash'), false);
      assert.strictEqual(bodyStr.includes('mobile_number'), false);
      assert.strictEqual(bodyStr.includes('+9198'), false);
      assert.strictEqual(bodyStr.includes('jwt'), false);
      assert.strictEqual(bodyStr.includes('token'), false);
    });
  });
});
