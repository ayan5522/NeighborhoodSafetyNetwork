const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

describe('Module 5: Community Verification Test Suite', () => {
  let userAToken = null;
  let userAId = null;
  let userBToken = null;
  let userBId = null;
  let userCToken = null;
  let userCId = null;
  let userDToken = null;
  let userDId = null;

  let testIncidentId = null;
  let disputeIncidentId = null;

  const testSuffix = Date.now();

  before(async () => {
    // 1. Clean up verifications and isolate test data
    await db.query('DELETE FROM incident_verifications');
    await db.query('DELETE FROM incidents WHERE title LIKE $1', ['%Verification Test%']);
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%verif%']);

    // Helper to register and verify user
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

    // User A: Incident Reporter
    const userA = await registerAndLogin(
      'Reporter User A',
      `reporter.verif.${testSuffix}@example.com`,
      '+919811111111'
    );
    userAId = userA.userId;
    userAToken = userA.token;

    // User B: Community Verifier 1
    const userB = await registerAndLogin(
      'Verifier User B',
      `verifierB.verif.${testSuffix}@example.com`,
      '+919822222222'
    );
    userBId = userB.userId;
    userBToken = userB.token;

    // User C: Community Verifier 2
    const userC = await registerAndLogin(
      'Verifier User C',
      `verifierC.verif.${testSuffix}@example.com`,
      '+919833333333'
    );
    userCId = userC.userId;
    userCToken = userC.token;

    // User D: Community Verifier 3
    const userD = await registerAndLogin(
      'Verifier User D',
      `verifierD.verif.${testSuffix}@example.com`,
      '+919844444444'
    );
    userDId = userD.userId;
    userDToken = userD.token;

    // Create primary test incident reported by User A
    const incRes1 = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        category: 'ACCIDENT',
        title: 'Verification Test Incident 1',
        description: 'Downed electrical pole blocking the road.',
        severity: 'HIGH',
        latitude: 16.9944,
        longitude: 73.3000,
      });
    testIncidentId = incRes1.body.data.id;

    // Create secondary test incident for dispute threshold testing
    const incRes2 = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        category: 'SUSPICIOUS_ACTIVITY',
        title: 'Verification Test Incident 2',
        description: 'Suspicious bicycle activity near shop.',
        severity: 'LOW',
        latitude: 16.9950,
        longitude: 73.3010,
      });
    disputeIncidentId = incRes2.body.data.id;
  });

  after(async () => {
    // Cleanup
    await db.query('DELETE FROM incident_verifications');
    if (userAId || userBId || userCId || userDId) {
      await db.query('DELETE FROM incidents WHERE reporter_id IN ($1, $2, $3, $4)', [
        userAId,
        userBId,
        userCId,
        userDId,
      ]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4)', [
        userAId,
        userBId,
        userCId,
        userDId,
      ]);
    }
  });

  describe('1. Authorization & Self-Verification Constraints', () => {
    test('should reject verification submission without authentication (401)', async () => {
      const res = await request(app)
        .post(`/api/incidents/${testIncidentId}/verify`)
        .send({ verification_type: 'CONFIRM' });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    test('should reject self-verification by the incident reporter (400)', async () => {
      const res = await request(app)
        .post(`/api/incidents/${testIncidentId}/verify`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ verification_type: 'CONFIRM' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /cannot verify your own/i);
    });
  });

  describe('2. Input Validation', () => {
    test('should reject missing verification_type (400)', async () => {
      const res = await request(app)
        .post(`/api/incidents/${testIncidentId}/verify`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({});

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors && res.body.errors.length > 0);
    });

    test('should reject invalid verification_type (400)', async () => {
      const res = await request(app)
        .post(`/api/incidents/${testIncidentId}/verify`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ verification_type: 'INVALID_TYPE' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.errors[0], /Invalid verification type/i);
    });

    test('should return 404 for non-existent incident UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post(`/api/incidents/${fakeId}/verify`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ verification_type: 'CONFIRM' });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /not found/i);
    });
  });

  describe('3. Successful Verification & Duplicate Prevention', () => {
    test('should allow User B to CONFIRM User A incident (201)', async () => {
      const res = await request(app)
        .post(`/api/incidents/${testIncidentId}/verify`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ verification_type: 'CONFIRM' });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.verification_type, 'CONFIRM');
      assert.strictEqual(res.body.data.incident_id, testIncidentId);
    });

    test('should reject duplicate CONFIRM from User B on the same incident (409)', async () => {
      const res = await request(app)
        .post(`/api/incidents/${testIncidentId}/verify`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ verification_type: 'CONFIRM' });

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /already submitted a verification/i);
    });

    test('should reject DISPUTE attempt from User B after already confirming (409)', async () => {
      const res = await request(app)
        .post(`/api/incidents/${testIncidentId}/verify`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ verification_type: 'DISPUTE' });

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /already submitted a verification/i);
    });
  });

  describe('4. Aggregation and Deterministic Status Calculation', () => {
    test('should return COMMUNITY_CONFIRMED when confirm_count is 1 and dispute_count is 0', async () => {
      const res = await request(app)
        .get(`/api/incidents/${testIncidentId}/verifications`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.confirm_count, 1);
      assert.strictEqual(res.body.data.dispute_count, 0);
      assert.strictEqual(res.body.data.status, 'COMMUNITY_CONFIRMED');
      assert.strictEqual(res.body.data.my_verification, 'CONFIRM');
    });

    test('should remain COMMUNITY_CONFIRMED when User C confirms (2 confirms, 0 disputes)', async () => {
      // User C confirms
      const verRes = await request(app)
        .post(`/api/incidents/${testIncidentId}/verify`)
        .set('Authorization', `Bearer ${userCToken}`)
        .send({ verification_type: 'CONFIRM' });
      assert.strictEqual(verRes.status, 201);

      // Check summary from User C perspective
      const res = await request(app)
        .get(`/api/incidents/${testIncidentId}/verifications`)
        .set('Authorization', `Bearer ${userCToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.confirm_count, 2);
      assert.strictEqual(res.body.data.dispute_count, 0);
      assert.strictEqual(res.body.data.status, 'COMMUNITY_CONFIRMED');
      assert.strictEqual(res.body.data.my_verification, 'CONFIRM');
    });

    test('should maintain COMMUNITY_CONFIRMED when User D disputes (2 confirms > 1 dispute)', async () => {
      // User D disputes
      const verRes = await request(app)
        .post(`/api/incidents/${testIncidentId}/verify`)
        .set('Authorization', `Bearer ${userDToken}`)
        .send({ verification_type: 'DISPUTE' });
      assert.strictEqual(verRes.status, 201);

      // Check summary from User D perspective
      const res = await request(app)
        .get(`/api/incidents/${testIncidentId}/verifications`)
        .set('Authorization', `Bearer ${userDToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.confirm_count, 2);
      assert.strictEqual(res.body.data.dispute_count, 1);
      assert.strictEqual(res.body.data.status, 'COMMUNITY_CONFIRMED');
      assert.strictEqual(res.body.data.my_verification, 'DISPUTE');
    });

    test('should correctly compute COMMUNITY_DISPUTED for dispute-heavy incident', async () => {
      // User B disputes incident 2
      await request(app)
        .post(`/api/incidents/${disputeIncidentId}/verify`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ verification_type: 'DISPUTE' });

      // User C disputes incident 2
      await request(app)
        .post(`/api/incidents/${disputeIncidentId}/verify`)
        .set('Authorization', `Bearer ${userCToken}`)
        .send({ verification_type: 'DISPUTE' });

      // Check status
      const res = await request(app)
        .get(`/api/incidents/${disputeIncidentId}/verifications`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.confirm_count, 0);
      assert.strictEqual(res.body.data.dispute_count, 2);
      assert.strictEqual(res.body.data.status, 'COMMUNITY_DISPUTED');
    });

    test('should return null for my_verification when requesting user has not verified', async () => {
      const res = await request(app)
        .get(`/api/incidents/${testIncidentId}/verifications`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.my_verification, null);
    });
  });

  describe('5. Privacy & Information Leakage Prevention', () => {
    test('should strictly omit verifier email, phone number, and password from responses', async () => {
      const verifyRes = await request(app)
        .get(`/api/incidents/${testIncidentId}/verifications`)
        .set('Authorization', `Bearer ${userBToken}`);

      const bodyStr = JSON.stringify(verifyRes.body);
      assert.strictEqual(bodyStr.includes('password'), false);
      assert.strictEqual(bodyStr.includes('email'), false);
      assert.strictEqual(bodyStr.includes('mobile_number'), false);
      assert.strictEqual(bodyStr.includes('+9198'), false);
      assert.strictEqual(bodyStr.includes('verifierB'), false);
      assert.strictEqual(bodyStr.includes('verifierC'), false);
    });
  });
});
