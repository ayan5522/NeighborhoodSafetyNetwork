const { describe, it } = require('node:test');
const assert = require('node:assert');
const { formatIndianMobileDisplay, maskMobileDisplay, maskEmailDisplay } = require('../src/utils/formatters');
const { validateEmail, validateMobile, calculatePasswordStrength } = require('../src/utils/validators');

describe('Mobile App Utilities and Validation Tests', () => {
  describe('Phone and Email Masking Formatter Tests', () => {
    it('should correctly format Indian mobile numbers for display', () => {
      assert.strictEqual(formatIndianMobileDisplay('+919876543210'), '+91 98765 43210');
      assert.strictEqual(formatIndianMobileDisplay('9876543210'), '+91 98765 43210');
    });

    it('should correctly mask mobile numbers for privacy', () => {
      assert.strictEqual(maskMobileDisplay('+919876543210'), '+91 ******3210');
      assert.strictEqual(maskMobileDisplay('9876543210'), '+91 ******3210');
    });

    it('should correctly mask email addresses for privacy', () => {
      assert.strictEqual(maskEmailDisplay('resident@example.com'), 'r******t@example.com');
      assert.strictEqual(maskEmailDisplay('me@domain.org'), 'm*@domain.org');
    });
  });

  describe('Validation Rule Tests', () => {
    it('should validate valid and invalid email addresses', () => {
      assert.strictEqual(validateEmail('test@example.com'), null);
      assert.notStrictEqual(validateEmail('invalid-email'), null);
      assert.notStrictEqual(validateEmail(''), null);
    });

    it('should validate Indian mobile numbers strictly', () => {
      assert.strictEqual(validateMobile('9876543210'), null);
      assert.strictEqual(validateMobile('+91 98765 43210'), null);
      assert.notStrictEqual(validateMobile('1234567890'), null); // Does not start with 6-9
      assert.notStrictEqual(validateMobile('98765'), null);
    });

    it('should calculate password strength accurately', () => {
      const weak = calculatePasswordStrength('pass');
      assert.strictEqual(weak.label, 'Weak');

      const medium = calculatePasswordStrength('Password12');
      assert.strictEqual(medium.label, 'Medium');

      const strong = calculatePasswordStrength('StrongPass@123');
      assert.strictEqual(strong.label, 'Strong');
      assert.strictEqual(strong.score, 5);
    });
  });
});
