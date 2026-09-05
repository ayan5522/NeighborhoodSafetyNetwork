/**
 * Module 4: Emergency Contact Validators
 */
const validateEmergencyContact = (data) => {
  const errors = [];
  const { name, phone_number, relationship } = data || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Contact name is required and must be at least 2 characters.');
  } else if (name.trim().length > 100) {
    errors.push('Contact name cannot exceed 100 characters.');
  }

  // Indian mobile validation (+91 or 10-digit standard)
  const phoneRegex = /^(\+91[\-\s]?)?[6789]\d{9}$/;
  if (!phone_number || typeof phone_number !== 'string' || !phoneRegex.test(phone_number.trim())) {
    errors.push('Please enter a valid 10-digit Indian mobile number (e.g., +919876543210 or 9876543210).');
  }

  if (relationship && (typeof relationship !== 'string' || relationship.trim().length > 50)) {
    errors.push('Relationship description cannot exceed 50 characters.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  validateEmergencyContact,
};
