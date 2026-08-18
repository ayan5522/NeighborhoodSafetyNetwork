const { normalizeIndianMobile, isValidIndianMobile } = require('../utils/phoneUtils');

/**
 * Custom validation helper functions
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const NAME_REGEX = /^[a-zA-Z\s.'-]{2,100}$/;
const OTP_REGEX = /^\d{6}$/;

/**
 * Password strength rules:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 numeric digit
 * - At least 1 special character
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return 'Password is required.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter (A-Z).';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter (a-z).';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number (0-9).';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one special character (!@#$%^&* etc.).';
  }
  return null;
}

function validateRegisterInput(data) {
  const errors = [];
  const { full_name, email, mobile_number, password, confirm_password } = data || {};

  // 1. Full Name
  if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
    errors.push('Full name is required.');
  } else {
    const trimmed = full_name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      errors.push('Full name must be between 2 and 100 characters.');
    } else if (!NAME_REGEX.test(trimmed)) {
      errors.push('Full name contains invalid characters. Use letters, spaces, dots, or hyphens only.');
    }
  }

  // 2. Email
  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email address is required.');
  } else {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      errors.push('Please enter a valid email address.');
    }
  }

  // 3. Mobile Number
  if (!mobile_number || typeof mobile_number !== 'string' || !mobile_number.trim()) {
    errors.push('Mobile number is required.');
  } else if (!isValidIndianMobile(mobile_number)) {
    errors.push('Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).');
  }

  // 4. Password
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    errors.push(passwordError);
  }

  // 5. Confirm Password
  if (!confirm_password || typeof confirm_password !== 'string') {
    errors.push('Please confirm your password.');
  } else if (password !== confirm_password) {
    errors.push('Passwords do not match.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      mobile_number: normalizeIndianMobile(mobile_number),
      password,
    } : null,
  };
}

function validateLoginInput(data) {
  const errors = [];
  const { email, password } = data || {};

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email address is required.');
  } else if (!EMAIL_REGEX.test(email.trim().toLowerCase())) {
    errors.push('Please enter a valid email address.');
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    errors.push('Password is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      email: email.trim().toLowerCase(),
      password,
    } : null,
  };
}

function validateVerifyOTPInput(data) {
  const errors = [];
  const { user_id, email, mobile_number, otp } = data || {};

  if (!user_id && !email && !mobile_number) {
    errors.push('User identifier (user_id, email, or mobile_number) is required.');
  }

  if (!otp || typeof otp !== 'string' || !OTP_REGEX.test(otp.trim())) {
    errors.push('Verification code must be a 6-digit number.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      user_id: user_id ? String(user_id).trim() : undefined,
      email: email ? String(email).trim().toLowerCase() : undefined,
      mobile_number: mobile_number ? normalizeIndianMobile(mobile_number) : undefined,
      otp: otp.trim(),
    } : null,
  };
}

function validateForgotPasswordInput(data) {
  const errors = [];
  const { channel, identifier } = data || {};

  if (!channel || (channel !== 'EMAIL' && channel !== 'SMS')) {
    errors.push('Channel must be either EMAIL or SMS.');
  }

  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    errors.push('Registered email or mobile number is required.');
  } else if (channel === 'EMAIL') {
    if (!EMAIL_REGEX.test(identifier.trim().toLowerCase())) {
      errors.push('Please provide a valid email address.');
    }
  } else if (channel === 'SMS') {
    if (!isValidIndianMobile(identifier)) {
      errors.push('Please provide a valid 10-digit Indian mobile number.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      channel,
      identifier: channel === 'EMAIL' ? identifier.trim().toLowerCase() : normalizeIndianMobile(identifier),
    } : null,
  };
}

function validateResetPasswordInput(data) {
  const errors = [];
  const { reset_token, new_password, confirm_password } = data || {};

  if (!reset_token || typeof reset_token !== 'string' || !reset_token.trim()) {
    errors.push('Reset token is required.');
  }

  const pwdError = validatePasswordStrength(new_password);
  if (pwdError) {
    errors.push(pwdError);
  }

  if (!confirm_password || new_password !== confirm_password) {
    errors.push('Passwords do not match.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      reset_token: reset_token.trim(),
      new_password,
    } : null,
  };
}

function validateUpdateProfileInput(data) {
  const errors = [];
  const { full_name, role, status, email, mobile_number, email_verified, mobile_verified } = data || {};

  // Reject attempts to update protected fields
  if (role !== undefined || status !== undefined || email !== undefined || mobile_number !== undefined || email_verified !== undefined || mobile_verified !== undefined) {
    errors.push('You cannot modify protected fields (role, status, email, mobile_number, verification flags) directly.');
  }

  if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
    errors.push('Full name is required.');
  } else {
    const trimmed = full_name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      errors.push('Full name must be between 2 and 100 characters.');
    } else if (!NAME_REGEX.test(trimmed)) {
      errors.push('Full name contains invalid characters.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      full_name: full_name.trim(),
    } : null,
  };
}

module.exports = {
  validateRegisterInput,
  validateLoginInput,
  validateVerifyOTPInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  validateUpdateProfileInput,
  validatePasswordStrength,
};
