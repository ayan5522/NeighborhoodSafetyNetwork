/**
 * Utilities for Indian Mobile Number Formatting & Validation
 */

/**
 * Normalizes an Indian mobile phone number to standard E.164-like format: +91XXXXXXXXXX
 * Handles formats like:
 * - 9876543210
 * - 09876543210
 * - +91 9876543210
 * - +91-98765-43210
 * - 919876543210
 * 
 * @param {string} phone
 * @returns {string|null} Normalized phone string (+91XXXXXXXXXX) or null if invalid
 */
function normalizeIndianMobile(phone) {
  if (!phone || typeof phone !== 'string') return null;

  // Remove spaces, hyphens, parentheses, and plus
  let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');

  // Remove leading + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // If starts with 91 and has 12 digits, strip 91
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }

  // If starts with 0 and has 11 digits, strip 0
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Validate that the remaining is 10 digits starting with 6, 7, 8, or 9
  const indianMobileRegex = /^[6-9]\d{9}$/;
  if (!indianMobileRegex.test(cleaned)) {
    return null;
  }

  return `+91${cleaned}`;
}

/**
 * Validate whether a string is a valid Indian mobile number.
 * @param {string} phone
 * @returns {boolean}
 */
function isValidIndianMobile(phone) {
  return normalizeIndianMobile(phone) !== null;
}

/**
 * Mask a phone number for safe display (e.g. +91 9876543210 -> +91 ******3210)
 * @param {string} phone
 * @returns {string}
 */
function maskMobile(phone) {
  if (!phone) return '';
  const normalized = normalizeIndianMobile(phone) || phone;
  if (normalized.length >= 10) {
    const last4 = normalized.slice(-4);
    return `+91 ******${last4}`;
  }
  return phone;
}

/**
 * Mask an email address for safe display (e.g. resident@example.com -> r***t@example.com)
 * @param {string} email
 * @returns {string}
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

module.exports = {
  normalizeIndianMobile,
  isValidIndianMobile,
  maskMobile,
  maskEmail,
};
