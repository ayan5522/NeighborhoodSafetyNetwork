const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { hashOTP } = require('../src/utils/cryptoUtils');

describe('Module 1: User & Authentication Management Comprehensive Test Suite', () => {
  // Test User Details
  const testUser = {
    full_name: 'Aarav Sharma',
    email: `aarav.test.${Date.now()}@example.com`,
    mobile_number: '+919876543210',
    password: 'Password@123',
    confirm_password: 'Password@123',
  };

  let registeredUserId;
  let authToken;
  let devEmailOtp;
  let devMobileOtp;

  before(async () => {
    // Ensure clean state for test user credentials
    await db.query('DELETE FROM users WHERE email LIKE $1 OR mobile_number = $2', ['%@example.com', testUser.mobile_number]);
  });

  after(async () => {
    await db.pool.end();
  });

  // -------------------------------------------------------------
  // REGISTRATION & VALIDATION TESTS (Tests 1-8)
  // -------------------------------------------------------------
  describe('1. Registration and Validation', () => {
    it('Test 2: should reject registration with missing full name', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          full_name: '',
          email: 'test@example.com',
          mobile_number: '9876543210',
          password: 'Password@123',
          confirm_password: 'Password@123',
        });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some(e => e.includes('Full name')));
    });

    it('Test 3: should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          full_name: 'Aarav Sharma',
          email: 'not-an-email',
          mobile_number: '9876543210',
          password: 'Password@123',
          confirm_password: 'Password@123',
        });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some(e => e.includes('email')));
    });

    it('Test 5: should reject registration with invalid Indian mobile number', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          full_name: 'Aarav Sharma',
          email: 'valid@example.com',
          mobile_number: '12345', // invalid
          password: 'Password@123',
          confirm_password: 'Password@123',
        });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some(e => e.includes('Indian mobile number')));
    });

    it('Test 7: should reject registration with weak password (missing special char or digit)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          full_name: 'Aarav Sharma',
          email: 'valid@example.com',
          mobile_number: '9876543210',
          password: 'password', // weak
          confirm_password: 'password',
        });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some(e => e.includes('Password')));
    });

    it('Test 8: should reject registration when confirm password does not match', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          full_name: 'Aarav Sharma',
          email: 'valid@example.com',
          mobile_number: '9876543210',
          password: 'Password@123',
          confirm_password: 'DifferentPassword@123',
        });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some(e => e.includes('Passwords do not match')));
    });

    it('Test 1: should successfully register a new user in PENDING_VERIFICATION state', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.user.id);
      assert.strictEqual(res.body.data.user.role, 'resident');
      assert.strictEqual(res.body.data.user.status, 'PENDING_VERIFICATION');
      assert.strictEqual(res.body.data.user.email_verified, false);
      assert.strictEqual(res.body.data.user.mobile_verified, false);
      // Ensure password hash or plaintext is never returned
      assert.strictEqual(res.body.data.user.password, undefined);
      assert.strictEqual(res.body.data.user.password_hash, undefined);

      registeredUserId = res.body.data.user.id;
      devEmailOtp = res.body.data.dev_email_otp;
      devMobileOtp = res.body.data.dev_mobile_otp;
    });

    it('Test 4: should reject duplicate email on registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          full_name: 'Another Name',
          email: testUser.email,
          mobile_number: '9876543211',
          password: 'Password@123',
          confirm_password: 'Password@123',
        });
      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('email address already exists'));
    });

    it('Test 6: should reject duplicate mobile number on registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          full_name: 'Another Name',
          email: 'different@example.com',
          mobile_number: testUser.mobile_number,
          password: 'Password@123',
          confirm_password: 'Password@123',
        });
      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('mobile number already exists'));
    });
  });

  // -------------------------------------------------------------
  // OTP GENERATION & VERIFICATION TESTS (Tests 9-15)
  // -------------------------------------------------------------
  describe('2. OTP Generation and Verification', () => {
    it('Test 9 & 15: should verify OTP was generated and stored securely (hashed)', async () => {
      assert.ok(devEmailOtp, 'Dev email OTP should have been generated');
      assert.ok(devMobileOtp, 'Dev mobile OTP should have been generated');

      // Verify DB contains hashed OTP, never plaintext
      const dbOtps = await db.query('SELECT * FROM otp_verifications WHERE user_id = $1', [registeredUserId]);
      assert.strictEqual(dbOtps.rows.length, 2);
      for (const row of dbOtps.rows) {
        assert.notStrictEqual(row.otp_hash, devEmailOtp);
        assert.notStrictEqual(row.otp_hash, devMobileOtp);
        assert.strictEqual(row.otp_hash.length, 64); // SHA-256 length
      }
    });

    it('Test 11: should reject invalid OTP with remaining attempts info', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({
          user_id: registeredUserId,
          otp: '000000',
        });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Incorrect verification code'));
    });

    it('Test 14: should enforce resend cooldown (60 seconds)', async () => {
      const res = await request(app)
        .post('/api/auth/resend-otp')
        .send({
          user_id: registeredUserId,
          purpose: 'EMAIL_VERIFICATION',
          channel: 'EMAIL',
        });
      assert.strictEqual(res.status, 429);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Please wait'));
    });

    it('Test 12: should reject expired OTP', async () => {
      // Artificially expire the OTP in database for testing
      await db.query(
        "UPDATE otp_verifications SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1 AND purpose = 'EMAIL_VERIFICATION'",
        [registeredUserId]
      );

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({
          user_id: registeredUserId,
          otp: devEmailOtp,
        });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('expired'));
    });

    it('Test 10: should verify email OTP when a new valid OTP is generated', async () => {
      // Re-generate fresh OTP
      await db.query("UPDATE otp_verifications SET created_at = NOW() - INTERVAL '70 seconds' WHERE user_id = $1", [registeredUserId]);
      
      const resendRes = await request(app)
        .post('/api/auth/resend-otp')
        .send({
          user_id: registeredUserId,
          purpose: 'EMAIL_VERIFICATION',
          channel: 'EMAIL',
        });
      assert.strictEqual(resendRes.status, 200);
      const newOtp = resendRes.body.data.dev_otp;

      const verifyRes = await request(app)
        .post('/api/auth/verify-email')
        .send({
          user_id: registeredUserId,
          otp: newOtp,
        });

      assert.strictEqual(verifyRes.status, 200);
      assert.strictEqual(verifyRes.body.success, true);
      assert.strictEqual(verifyRes.body.data.user.email_verified, true);
      // Status should still be PENDING_VERIFICATION since mobile is not yet verified
      assert.strictEqual(verifyRes.body.data.is_fully_activated, false);
    });

    it('Test 15: should verify mobile OTP and transition account status to ACTIVE', async () => {
      const verifyRes = await request(app)
        .post('/api/auth/verify-mobile')
        .send({
          user_id: registeredUserId,
          otp: devMobileOtp,
        });

      assert.strictEqual(verifyRes.status, 200);
      assert.strictEqual(verifyRes.body.success, true);
      assert.strictEqual(verifyRes.body.data.user.mobile_verified, true);
      assert.strictEqual(verifyRes.body.data.user.email_verified, true);
      assert.strictEqual(verifyRes.body.data.user.status, 'ACTIVE');
      assert.strictEqual(verifyRes.body.data.is_fully_activated, true);
    });
  });

  // -------------------------------------------------------------
  // LOGIN & AUTHENTICATION TESTS (Tests 16-18)
  // -------------------------------------------------------------
  describe('3. Login and Authentication Gateway', () => {
    it('Test 17: should reject login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword@123',
        });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Invalid email address or password.');
    });

    it('Test 18: should reject login for unverified account', async () => {
      // Create a dummy unverified user
      const unverifiedRes = await request(app)
        .post('/api/auth/register')
        .send({
          full_name: 'Unverified Resident',
          email: 'unverified@example.com',
          mobile_number: '9876543299',
          password: 'Password@123',
          confirm_password: 'Password@123',
        });
      assert.strictEqual(unverifiedRes.status, 201);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unverified@example.com',
          password: 'Password@123',
        });
      assert.strictEqual(loginRes.status, 403);
      assert.strictEqual(loginRes.body.success, false);
      assert.ok(loginRes.body.message.includes('pending verification'));
    });

    it('Test 16: should successfully login with valid credentials and return JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.strictEqual(res.body.data.user.email, testUser.email);
      assert.strictEqual(res.body.data.user.status, 'ACTIVE');
      assert.strictEqual(res.body.data.user.role, 'resident');

      authToken = res.body.data.token;
    });
  });

  // -------------------------------------------------------------
  // PROTECTED ROUTES & PROFILE TESTS (Tests 19-23)
  // -------------------------------------------------------------
  describe('4. Protected Routes and Profile Management', () => {
    it('Test 19: should reject GET /api/users/me without JWT token (401)', async () => {
      const res = await request(app).get('/api/users/me');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('Test 20: should reject GET /api/users/me with invalid/malformed JWT (401)', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid_garbage_token_123');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('Test 21: should return user profile with valid JWT (200)', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user.id, registeredUserId);
      assert.strictEqual(res.body.data.user.full_name, testUser.full_name);
      assert.strictEqual(res.body.data.user.password, undefined);
      assert.strictEqual(res.body.data.user.password_hash, undefined);
    });

    it('Test 22: should allow updating full_name on PATCH /api/users/me', async () => {
      const updatedName = 'Aarav K. Sharma';
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ full_name: updatedName });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user.full_name, updatedName);
    });

    it('Test 23: should reject unauthorized attempts to change role/status via PATCH /api/users/me', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'admin', status: 'ACTIVE' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some(e => e.includes('protected fields')));
    });
  });

  // -------------------------------------------------------------
  // FORGOT & RESET PASSWORD TESTS (Tests 24-29)
  // -------------------------------------------------------------
  describe('5. Password Reset Recovery Flow', () => {
    let resetOtp;
    let resetToken;

    it('Test 24: should handle forgot password via Email with generic anti-enumeration response', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          channel: 'EMAIL',
          identifier: testUser.email,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.message.includes('verification code has been dispatched'));
      resetOtp = res.body.data?.dev_otp;
    });

    it('Test 25: should handle forgot password via Mobile with generic anti-enumeration response', async () => {
      // Cooldown reset for test
      await db.query("UPDATE otp_verifications SET created_at = NOW() - INTERVAL '70 seconds' WHERE user_id = $1", [registeredUserId]);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          channel: 'SMS',
          identifier: testUser.mobile_number,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.message.includes('verification code has been dispatched'));
      resetOtp = res.body.data?.dev_otp;
    });

    it('Test 26: should reject invalid password reset OTP', async () => {
      const res = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({
          identifier: testUser.email,
          channel: 'EMAIL',
          otp: '111111',
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Incorrect verification code'));
    });

    it('Test 27: should reject expired password reset OTP', async () => {
      await db.query(
        "UPDATE otp_verifications SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1 AND purpose = 'PASSWORD_RESET'",
        [registeredUserId]
      );

      const res = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({
          identifier: testUser.email,
          channel: 'EMAIL',
          otp: resetOtp,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('expired'));
    });

    it('Test 28: should successfully verify valid reset OTP and issue reset token', async () => {
      // Create fresh reset OTP
      await db.query("UPDATE otp_verifications SET created_at = NOW() - INTERVAL '70 seconds' WHERE user_id = $1", [registeredUserId]);
      const initRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ channel: 'EMAIL', identifier: testUser.email });
      const validResetOtp = initRes.body.data.dev_otp;

      const verifyRes = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({
          identifier: testUser.email,
          channel: 'EMAIL',
          otp: validResetOtp,
        });

      assert.strictEqual(verifyRes.status, 200);
      assert.strictEqual(verifyRes.body.success, true);
      assert.ok(verifyRes.body.data.reset_token);
      resetToken = verifyRes.body.data.reset_token;
    });

    it('Test 28 (cont.): should successfully update password with valid reset token', async () => {
      const newPassword = 'NewSecretPassword@2026';
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          reset_token: resetToken,
          new_password: newPassword,
          confirm_password: newPassword,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.message.includes('reset successfully'));
    });

    it('Test 29: should successfully login using the new password and reject old password', async () => {
      // Old password should fail
      const failRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });
      assert.strictEqual(failRes.status, 401);

      // New password should succeed
      const successRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'NewSecretPassword@2026',
        });
      assert.strictEqual(successRes.status, 200);
      assert.strictEqual(successRes.body.success, true);
      assert.ok(successRes.body.data.token);
    });
  });

  // -------------------------------------------------------------
  // LOGOUT TESTS (Test 30)
  // -------------------------------------------------------------
  describe('6. Logout', () => {
    it('Test 30: should handle logout endpoint gracefully', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.message.includes('Logged out'));
    });
  });
});
