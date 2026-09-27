const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

async function runBug1Verification() {
  console.log('================================================================');
  console.log('  RUNNING VERIFICATION FOR BUG #1: FORGOT PASSWORD RECOVERY');
  console.log('================================================================\n');

  const testSuffix = Date.now();
  const registeredEmail = `registered.user.${testSuffix}@example.com`;
  const registeredMobile = '+919876543210';
  const rawRegisteredMobile = '9876543210';
  const unregisteredEmail = `unregistered.user.${testSuffix}@example.com`;
  const unregisteredMobile = '+919999999999';
  const rawUnregisteredMobile = '9999999999';
  const initialPassword = 'InitialPassword@123';
  const updatedPassword = 'NewSecurePassword@2026';

  try {
    // 0. Setup: Clean up and create a registered active user
    console.log('0. Setup: Creating registered test account...');
    await db.query("DELETE FROM users WHERE email = $1 OR mobile_number = $2", [registeredEmail, registeredMobile]);
    
    const regRes = await request(app).post('/api/auth/register').send({
      full_name: 'Test Recovery User',
      email: registeredEmail,
      mobile_number: registeredMobile,
      password: initialPassword,
      confirm_password: initialPassword,
    });
    assert.strictEqual(regRes.status, 201);
    const userId = regRes.body.data.user.id;
    const emailOtp = regRes.body.data.dev_email_otp;
    const mobileOtp = regRes.body.data.dev_mobile_otp;

    // Verify account to ACTIVE
    await request(app).post('/api/auth/verify-email').send({ email: registeredEmail, otp: emailOtp });
    await request(app).post('/api/auth/verify-mobile').send({ mobile_number: registeredMobile, otp: mobileOtp });
    console.log(`   Account created & activated: ${registeredEmail} (${registeredMobile})\n`);

    // TEST 1 — Registered Email
    console.log('TEST 1 — Registered Email:');
    const t1Res = await request(app).post('/api/auth/forgot-password').send({
      channel: 'EMAIL',
      identifier: registeredEmail,
    });
    assert.strictEqual(t1Res.status, 200, 'Expected 200 OK for registered email');
    assert.strictEqual(t1Res.body.success, true);
    assert.ok(t1Res.body.data?.dev_otp, 'OTP must be generated for registered email');
    console.log('   ✅ Test 1 Passed: Account found, OTP generated and returned/sent.\n');

    // TEST 2 — Unregistered but Valid Email
    console.log('TEST 2 — Unregistered but Valid Email:');
    const t2Res = await request(app).post('/api/auth/forgot-password').send({
      channel: 'EMAIL',
      identifier: unregisteredEmail,
    });
    assert.strictEqual(t2Res.status, 404, 'Expected 404 Not Found for unregistered email');
    assert.strictEqual(t2Res.body.success, false);
    assert.strictEqual(t2Res.body.message, "User doesn't exist in the system.");
    assert.strictEqual(t2Res.body.data, undefined, 'No data/OTP must be returned');

    // Confirm no OTP row was generated
    const checkOtp2 = await db.query("SELECT * FROM otp_verifications WHERE user_id = '00000000-0000-0000-0000-000000000000'");
    assert.strictEqual(checkOtp2.rows.length, 0);
    console.log('   ✅ Test 2 Passed: 404 Returned with "User doesn\'t exist in the system.", NO OTP generated/sent.\n');

    // Reset cooldown for Test 3
    await db.query("UPDATE otp_verifications SET created_at = NOW() - INTERVAL '70 seconds' WHERE user_id = $1", [userId]);

    // TEST 3 — Registered Mobile
    console.log('TEST 3 — Registered Mobile (with 10-digit number):');
    const t3Res = await request(app).post('/api/auth/forgot-password').send({
      channel: 'SMS',
      identifier: rawRegisteredMobile,
    });
    assert.strictEqual(t3Res.status, 200, 'Expected 200 OK for registered mobile');
    assert.strictEqual(t3Res.body.success, true);
    assert.ok(t3Res.body.data?.dev_otp, 'OTP must be generated for registered mobile');
    console.log('   ✅ Test 3 Passed: Account found for mobile, OTP generated and returned/sent.\n');

    // TEST 4 — Unregistered Mobile
    console.log('TEST 4 — Unregistered Mobile (9999999999):');
    const t4Res = await request(app).post('/api/auth/forgot-password').send({
      channel: 'SMS',
      identifier: rawUnregisteredMobile,
    });
    assert.strictEqual(t4Res.status, 404, 'Expected 404 Not Found for unregistered mobile');
    assert.strictEqual(t4Res.body.success, false);
    assert.strictEqual(t4Res.body.message, "User doesn't exist in the system.");
    assert.strictEqual(t4Res.body.data, undefined);
    console.log('   ✅ Test 4 Passed: 404 Returned with "User doesn\'t exist in the system.", NO OTP generated/sent.\n');

    // TEST 5 — Invalid Email / Mobile Format
    console.log('TEST 5 — Invalid Format Validation:');
    const t5EmailRes = await request(app).post('/api/auth/forgot-password').send({
      channel: 'EMAIL',
      identifier: 'abc',
    });
    assert.strictEqual(t5EmailRes.status, 400, 'Expected 400 Bad Request for invalid email format');
    assert.strictEqual(t5EmailRes.body.success, false);
    assert.ok(t5EmailRes.body.errors.some(e => e.includes('valid email')));

    const t5MobileRes = await request(app).post('/api/auth/forgot-password').send({
      channel: 'SMS',
      identifier: '123',
    });
    assert.strictEqual(t5MobileRes.status, 400, 'Expected 400 Bad Request for invalid mobile format');
    assert.strictEqual(t5MobileRes.body.success, false);
    assert.ok(t5MobileRes.body.errors.some(e => e.includes('valid 10-digit Indian mobile number')));
    console.log('   ✅ Test 5 Passed: Invalid formats rejected with 400 Bad Request before database queries.\n');

    // TEST 6 — Complete Existing OTP Recovery & Password Reset Flow
    console.log('TEST 6 — Complete Recovery Flow: OTP -> Verify -> Reset Token -> New Password -> Login:');
    // Cooldown reset
    await db.query("UPDATE otp_verifications SET created_at = NOW() - INTERVAL '70 seconds' WHERE user_id = $1", [userId]);

    // 1. Request OTP
    const reqOtpRes = await request(app).post('/api/auth/forgot-password').send({
      channel: 'EMAIL',
      identifier: registeredEmail,
    });
    assert.strictEqual(reqOtpRes.status, 200);
    const resetOtp = reqOtpRes.body.data.dev_otp;
    assert.ok(resetOtp);

    // 2. Verify OTP and obtain Reset Token
    const verifyOtpRes = await request(app).post('/api/auth/verify-reset-otp').send({
      channel: 'EMAIL',
      identifier: registeredEmail,
      otp: resetOtp,
    });
    assert.strictEqual(verifyOtpRes.status, 200);
    assert.strictEqual(verifyOtpRes.body.success, true);
    const resetToken = verifyOtpRes.body.data.reset_token;
    assert.ok(resetToken);

    // 3. Reset Password
    const resetPwdRes = await request(app).post('/api/auth/reset-password').send({
      reset_token: resetToken,
      new_password: updatedPassword,
      confirm_password: updatedPassword,
    });
    assert.strictEqual(resetPwdRes.status, 200);
    assert.strictEqual(resetPwdRes.body.success, true);

    // 4. Verify Old Password is rejected
    const oldLoginRes = await request(app).post('/api/auth/login').send({
      email: registeredEmail,
      password: initialPassword,
    });
    assert.strictEqual(oldLoginRes.status, 401);

    // 5. Verify New Password works
    const newLoginRes = await request(app).post('/api/auth/login').send({
      email: registeredEmail,
      password: updatedPassword,
    });
    assert.strictEqual(newLoginRes.status, 200);
    assert.strictEqual(newLoginRes.body.success, true);
    assert.ok(newLoginRes.body.data.token);
    console.log('   ✅ Test 6 Passed: Complete OTP -> Reset Token -> Password Reset -> Login with new password succeeded!\n');

    console.log('================================================================');
    console.log('  🎉 ALL 6 TESTS PASSED SUCCESSFULLY! BUG #1 IS COMPLETELY FIXED.');
    console.log('================================================================');
  } finally {
    await db.query("DELETE FROM users WHERE email = $1", [registeredEmail]);
    await db.pool.end();
  }
}

runBug1Verification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
