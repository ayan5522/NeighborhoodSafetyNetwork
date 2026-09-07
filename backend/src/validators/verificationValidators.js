const { VALID_VERIFICATION_TYPES } = require('../constants/verificationTypes');

/**
 * Validate input for submitting an incident verification.
 */
function validateSubmitVerificationInput(data) {
  const errors = [];
  const { verification_type, verificationType } = data || {};
  const type = verification_type || verificationType;

  if (!type || typeof type !== 'string' || !type.trim()) {
    errors.push('Verification type is required.');
  } else {
    const normalizedType = type.trim().toUpperCase();
    if (!VALID_VERIFICATION_TYPES.includes(normalizedType)) {
      errors.push(`Invalid verification type. Allowed values: ${VALID_VERIFICATION_TYPES.join(', ')}.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      verification_type: type.trim().toUpperCase(),
    } : null,
  };
}

module.exports = {
  validateSubmitVerificationInput,
};
