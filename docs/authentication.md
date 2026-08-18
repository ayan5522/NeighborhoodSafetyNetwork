# Module 1: User & Authentication Management Specification

## Architecture & Design Principles

The **Neighborhood Safety Network** authentication subsystem is built using 100% free and open-source components with zero reliance on proprietary cloud services (such as Firebase, Supabase, Auth0, or paid SMS APIs).

```
+-----------------------------------------------------------------------------------+
|                                 REACT NATIVE APP                                  |
|   +---------------------+   +---------------------+   +-----------------------+   |
|   |  RegistrationScreen |   | Email & SMS OTP Scrn|   | Login & Profile Screens|  |
|   +----------+----------+   +----------+----------+   +-----------+-----------+   |
|              |                         |                          |               |
|              +-------------------------+--------------------------+               |
|                                        |                                          |
|                          Secure Storage (Keystore/Keychain)                       |
+----------------------------------------+------------------------------------------+
                                         | REST API (JSON / Bearer JWT)
                                         v
+-----------------------------------------------------------------------------------+
|                                 EXPRESS BACKEND                                   |
|   +---------------------------------------------------------------------------+   |
|   | Middleware: CORS, Helmet, RateLimiter, InputValidator, requireAuth/Role   |   |
|   +------------------------------------+--------------------------------------+   |
|                                        |                                          |
|   +------------------------------------+--------------------------------------+   |
|   | Services: AuthService, UserService, OTPService (Strategy Pattern)         |   |
|   +----+-------------------------------+--------------------------------------+   |
|        |                               |                                          |
|        v                               v                                          |
|   +----+---------------------+   +-----+--------------------------------------+   |
|   | OTP Providers:           |   | PostgreSQL Database (pg pool, raw SQL)     |   |
|   | - SmtpEmailOTPProvider   |   | - users (UUID, bcrypt hash, status)        |   |
|   | - MockSMSOTPProvider     |   | - otp_verifications (SHA-256 hashed OTP)   |   |
|   +--------------------------+   +--------------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

---

## 1. User Lifecycle & Activation Rules

1. **Registration**: User submits registration form (`full_name`, `email`, `mobile_number`, `password`, `confirm_password`).
   - Role defaults strictly to `resident`.
   - Initial status is `PENDING_VERIFICATION`.
   - `email_verified` = `FALSE`, `mobile_verified` = `FALSE`.
   - Generates Email OTP and Mobile OTP.
2. **Email Verification**: User enters 6-digit OTP received on email.
   - Endpoint: `POST /api/auth/verify-email`.
   - Sets `email_verified = TRUE`, `email_verified_at = NOW()`.
3. **Mobile Verification**: User enters 6-digit OTP received on mobile.
   - Endpoint: `POST /api/auth/verify-mobile`.
   - Sets `mobile_verified = TRUE`, `mobile_verified_at = NOW()`.
4. **Activation**: When both `email_verified` and `mobile_verified` are `TRUE`, the account status is transitioned to `ACTIVE`.
5. **Login Gatekeeping**: Only users with `status = 'ACTIVE'` can generate an access JWT and log in.

---

## 2. OTP Security Architecture

- **Generation**: `crypto.randomInt(100000, 1000000)` produces a 6-digit integer.
- **Storage**: The plain OTP is hashed using SHA-256 (`crypto.createHash('sha256').update(otp).digest('hex')`) before saving to `otp_verifications`. Plaintext OTP is NEVER stored in database tables.
- **Expiry**: 5 minutes (`expires_at = NOW() + INTERVAL '5 minutes'`).
- **Attempt Limit**: Maximum 3 attempts per OTP. If exceeded, the OTP is invalidated.
- **Resend Cooldown**: Enforces a 60-second delay between resend requests.
- **Invalidation**: Creating a new OTP marks all previous active OTPs for the same user and purpose as expired.
- **Development Testing**: When `NODE_ENV=development`, OTPs are printed to terminal logs and accessible via a dev inspection route (`GET /api/dev/otps`) for end-to-end testing without external network dependencies.

---

## 3. Password Security & Reset Architecture

- **Hashing**: Passwords are saved as bcrypt hashes with salt rounds of 12. Plain passwords are never logged or stored.
- **Forgot Password**: Supports request via either registered `email` or `mobile_number`.
- **Anti-Enumeration**: Regardless of whether the provided email/mobile exists, the endpoint returns:
  `"If the account exists, a verification code has been sent."`
  This prevents malicious actors from harvesting registered numbers or emails.
- **Verification**: OTP is verified via `POST /api/auth/verify-reset-otp`, returning a short-lived, signed JWT reset token (15-minute validity).
- **Password Update**: `POST /api/auth/reset-password` accepts `reset_token` and `new_password`, hashes the new password, updates the user record, and invalidates the OTP.

---

## 4. API Endpoints Reference

| Method | Route | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new resident | No |
| `POST` | `/api/auth/verify-email` | Verify email OTP | No |
| `POST` | `/api/auth/verify-mobile` | Verify Indian mobile OTP | No |
| `POST` | `/api/auth/resend-otp` | Resend verification OTP | No |
| `POST` | `/api/auth/login` | Login with email & password | No |
| `POST` | `/api/auth/forgot-password` | Request password reset OTP | No |
| `POST` | `/api/auth/verify-reset-otp` | Verify reset OTP & get reset token | No |
| `POST` | `/api/auth/reset-password` | Set new password with reset token | No |
| `POST` | `/api/auth/logout` | Client token removal & logout ack | Yes (Bearer) |
| `GET` | `/api/users/me` | Fetch authenticated profile | Yes (Bearer) |
| `PATCH` | `/api/users/me` | Update allowed fields (`full_name`) | Yes (Bearer) |
| `GET` | `/api/dev/otps` | Local dev inspector (dev mode only) | No |
