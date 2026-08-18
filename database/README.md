# Database Documentation: Module 1 (User & Authentication Management)

This directory contains the database schema, initialization scripts, and operational guidance for the **Neighborhood Safety Network** project.

## Schema Overview

### 1. `users` Table
Stores resident and administrative user credentials, profile attributes, and verification states.

- `id` (UUID): Secure unique identifier (UUID v4).
- `full_name` (VARCHAR): Resident's full name.
- `email` (VARCHAR): Unique normalized email address.
- `mobile_number` (VARCHAR): Unique normalized Indian mobile number (`+91XXXXXXXXXX`).
- `password_hash` (VARCHAR): Salted `bcrypt` hash (rounds: 12).
- `role` (VARCHAR): Account authorization tier (`resident`, `moderator`, `admin`). Defaults strictly to `resident`.
- `status` (VARCHAR): Account activation state (`PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`).
- `email_verified` (BOOLEAN): Verification flag for email OTP.
- `email_verified_at` (TIMESTAMPTZ): Timestamp when email was successfully verified.
- `mobile_verified` (BOOLEAN): Verification flag for mobile OTP.
- `mobile_verified_at` (TIMESTAMPTZ): Timestamp when mobile number was successfully verified.
- `created_at` / `updated_at` (TIMESTAMPTZ): Audit timestamps managed via database trigger.

### 2. `otp_verifications` Table
Securely manages short-lived one-time passwords for email verification, mobile verification, and password reset flows.

- `id` (UUID): Primary key.
- `user_id` (UUID): Foreign key referencing `users(id)` with cascading deletion.
- `purpose` (VARCHAR): `EMAIL_VERIFICATION`, `MOBILE_VERIFICATION`, or `PASSWORD_RESET`.
- `channel` (VARCHAR): Delivery mechanism (`EMAIL` or `SMS`).
- `otp_hash` (VARCHAR): SHA-256 hash of the 6-digit OTP code (never stored in plaintext).
- `expires_at` (TIMESTAMPTZ): Expiry timestamp (5 minutes from generation).
- `attempts` (INT): Number of verification attempts made (max 3).
- `verified_at` (TIMESTAMPTZ): Timestamp of successful verification.
- `created_at` (TIMESTAMPTZ): Creation timestamp (used to enforce 60-second resend cooldown).

## Running Migrations

1. Ensure PostgreSQL is running (e.g. via `docker-compose up -d postgres`).
2. Run migrations from the backend directory:
   ```bash
   cd backend
   npm run migrate
   ```
