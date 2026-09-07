const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

async function runEndToEndVerificationTests() {
  console.log('🚀 Running Module 5 Community Verification Bug Fix Verification (Tests A - F)...');
  const testSuffix = Date.now();

  // 1. Cleanup isolated test data (by email prefix and test mobile numbers)
  await db.query('DELETE FROM incident_verifications');
  await db.query('DELETE FROM incidents WHERE title LIKE $1', ['%E2E Verification%']);
  await db.query('DELETE FROM users WHERE email LIKE $1 OR mobile_number LIKE $2', ['%e2e.verif%', '+919899999%']);

  async function registerAndLogin(name, email, mobile) {
    const regRes = await request(app).post('/api/auth/register').send({
      full_name: name,
      email,
      mobile_number: mobile,
      password: 'Password@123',
      confirm_password: 'Password@123',
    });
    if (!regRes.body.success) {
      throw new Error(`Register failed for ${email}: ${JSON.stringify(regRes.body)}`);
    }
    const userId = regRes.body.data.user.id;
    await request(app).post('/api/auth/verify-email').send({ email, otp: regRes.body.data.dev_email_otp });
    await request(app).post('/api/auth/verify-mobile').send({ mobile_number: mobile, otp: regRes.body.data.dev_mobile_otp });
    const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'Password@123' });
    return { userId, token: loginRes.body.data.token };
  }

  const userA = await registerAndLogin('User A Reporter', `usera.e2e.verif.${testSuffix}@example.com`, `+919899999001`);
  const userB = await registerAndLogin('User B Verifier', `userb.e2e.verif.${testSuffix}@example.com`, `+919899999002`);
  const userC = await registerAndLogin('User C Disputer', `userc.e2e.verif.${testSuffix}@example.com`, `+919899999003`);
  const userD = await registerAndLogin('User D Verifier', `userd.e2e.verif.${testSuffix}@example.com`, `+919899999004`);
  const userE = await registerAndLogin('User E Disputer', `usere.e2e.verif.${testSuffix}@example.com`, `+919899999005`);
  const userF = await registerAndLogin('User F Disputer', `userf.e2e.verif.${testSuffix}@example.com`, `+919899999006`);

  // TEST A: Create a new incident -> 0 confirms, 0 disputes, UNVERIFIED
  console.log('TEST A: User A creates a new incident...');
  const createRes = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${userA.token}`)
    .send({
      category: 'ROAD_HAZARD',
      title: 'E2E Verification Pothole Test',
      description: 'Deep hazardous pothole on highway near flyover.',
      severity: 'HIGH',
      latitude: 16.9922,
      longitude: 73.3115,
    });
  assert.strictEqual(createRes.status, 201);
  const incidentId = createRes.body.data.id;

  const getVerifA = await request(app)
    .get(`/api/incidents/${incidentId}/verifications`)
    .set('Authorization', `Bearer ${userA.token}`);
  assert.strictEqual(getVerifA.status, 200);
  assert.strictEqual(getVerifA.body.data.confirm_count, 0);
  assert.strictEqual(getVerifA.body.data.dispute_count, 0);
  assert.strictEqual(getVerifA.body.data.status, 'UNVERIFIED');
  assert.strictEqual(getVerifA.body.data.my_verification, null);
  console.log('✅ TEST A Passed: Initial state is 0 confirms, 0 disputes -> UNVERIFIED');

  // TEST B: User B confirms -> 1 confirm, 0 disputes, COMMUNITY_CONFIRMED
  console.log('TEST B: User B confirms the incident...');
  const postConfirmB = await request(app)
    .post(`/api/incidents/${incidentId}/verify`)
    .set('Authorization', `Bearer ${userB.token}`)
    .send({ verification_type: 'CONFIRM' });
  assert.strictEqual(postConfirmB.status, 201);

  const getVerifB = await request(app)
    .get(`/api/incidents/${incidentId}/verifications`)
    .set('Authorization', `Bearer ${userB.token}`);
  assert.strictEqual(getVerifB.body.data.confirm_count, 1);
  assert.strictEqual(getVerifB.body.data.dispute_count, 0);
  assert.strictEqual(getVerifB.body.data.status, 'COMMUNITY_CONFIRMED');
  assert.strictEqual(getVerifB.body.data.my_verification, 'CONFIRM');
  console.log('✅ TEST B Passed: 1 confirm, 0 disputes -> COMMUNITY_CONFIRMED');

  // TEST C: User C disputes -> 1 confirm, 1 dispute, UNVERIFIED
  console.log('TEST C: User C disputes the same incident...');
  const postDisputeC = await request(app)
    .post(`/api/incidents/${incidentId}/verify`)
    .set('Authorization', `Bearer ${userC.token}`)
    .send({ verification_type: 'DISPUTE' });
  assert.strictEqual(postDisputeC.status, 201);

  const getVerifC = await request(app)
    .get(`/api/incidents/${incidentId}/verifications`)
    .set('Authorization', `Bearer ${userC.token}`);
  assert.strictEqual(getVerifC.body.data.confirm_count, 1);
  assert.strictEqual(getVerifC.body.data.dispute_count, 1);
  assert.strictEqual(getVerifC.body.data.status, 'UNVERIFIED');
  assert.strictEqual(getVerifC.body.data.my_verification, 'DISPUTE');
  console.log('✅ TEST C Passed: 1 confirm, 1 dispute -> UNVERIFIED');

  // TEST D: User D confirms -> 2 confirms, 1 dispute, COMMUNITY_CONFIRMED
  console.log('TEST D: User D confirms the incident...');
  const postConfirmD = await request(app)
    .post(`/api/incidents/${incidentId}/verify`)
    .set('Authorization', `Bearer ${userD.token}`)
    .send({ verification_type: 'CONFIRM' });
  assert.strictEqual(postConfirmD.status, 201);

  const getVerifD = await request(app)
    .get(`/api/incidents/${incidentId}/verifications`)
    .set('Authorization', `Bearer ${userD.token}`);
  assert.strictEqual(getVerifD.body.data.confirm_count, 2);
  assert.strictEqual(getVerifD.body.data.dispute_count, 1);
  assert.strictEqual(getVerifD.body.data.status, 'COMMUNITY_CONFIRMED');
  assert.strictEqual(getVerifD.body.data.my_verification, 'CONFIRM');
  console.log('✅ TEST D Passed: 2 confirms, 1 dispute -> COMMUNITY_CONFIRMED');

  // TEST E: User E disputes -> 2 confirms, 2 disputes, UNVERIFIED
  console.log('TEST E: User E disputes the incident...');
  const postDisputeE = await request(app)
    .post(`/api/incidents/${incidentId}/verify`)
    .set('Authorization', `Bearer ${userE.token}`)
    .send({ verification_type: 'DISPUTE' });
  assert.strictEqual(postDisputeE.status, 201);

  const getVerifE = await request(app)
    .get(`/api/incidents/${incidentId}/verifications`)
    .set('Authorization', `Bearer ${userE.token}`);
  assert.strictEqual(getVerifE.body.data.confirm_count, 2);
  assert.strictEqual(getVerifE.body.data.dispute_count, 2);
  assert.strictEqual(getVerifE.body.data.status, 'UNVERIFIED');
  assert.strictEqual(getVerifE.body.data.my_verification, 'DISPUTE');
  console.log('✅ TEST E Passed: 2 confirms, 2 disputes -> UNVERIFIED');

  // TEST F: User F disputes -> 2 confirms, 3 disputes, COMMUNITY_DISPUTED
  console.log('TEST F: User F disputes making disputes > confirms...');
  const postDisputeF = await request(app)
    .post(`/api/incidents/${incidentId}/verify`)
    .set('Authorization', `Bearer ${userF.token}`)
    .send({ verification_type: 'DISPUTE' });
  assert.strictEqual(postDisputeF.status, 201);

  const getVerifF = await request(app)
    .get(`/api/incidents/${incidentId}/verifications`)
    .set('Authorization', `Bearer ${userF.token}`);
  assert.strictEqual(getVerifF.body.data.confirm_count, 2);
  assert.strictEqual(getVerifF.body.data.dispute_count, 3);
  assert.strictEqual(getVerifF.body.data.status, 'COMMUNITY_DISPUTED');
  assert.strictEqual(getVerifF.body.data.my_verification, 'DISPUTE');
  console.log('✅ TEST F Passed: 2 confirms, 3 disputes -> COMMUNITY_DISPUTED');

  // Additional Constraints: Duplicate Prevention & Self-verification block
  console.log('Verifying constraints: Duplicate vote rejection and self-verification block...');
  const dupRes = await request(app)
    .post(`/api/incidents/${incidentId}/verify`)
    .set('Authorization', `Bearer ${userB.token}`)
    .send({ verification_type: 'CONFIRM' });
  assert.strictEqual(dupRes.status, 409);

  const selfRes = await request(app)
    .post(`/api/incidents/${incidentId}/verify`)
    .set('Authorization', `Bearer ${userA.token}`)
    .send({ verification_type: 'CONFIRM' });
  assert.strictEqual(selfRes.status, 400);
  console.log('✅ Constraints verified: Duplicate vote rejected (409) and Self-verification blocked (400)');

  // Cleanup
  await db.query('DELETE FROM incident_verifications WHERE incident_id = $1', [incidentId]);
  await db.query('DELETE FROM incidents WHERE id = $1', [incidentId]);
  await db.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5, $6)', [
    userA.userId,
    userB.userId,
    userC.userId,
    userD.userId,
    userE.userId,
    userF.userId,
  ]);

  console.log('🎉 ALL TESTS A - F AND SECURITY CONSTRAINTS PASSED PERFECTLY!');
}

runEndToEndVerificationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
  });
