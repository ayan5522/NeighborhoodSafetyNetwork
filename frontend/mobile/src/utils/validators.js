export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export function validateEmail(email) {
  if (!email || !email.trim()) return 'Email address is required.';
  if (!EMAIL_REGEX.test(email.trim().toLowerCase())) return 'Enter a valid email address.';
  return null;
}

export function validateMobile(mobile) {
  if (!mobile || !mobile.trim()) return 'Mobile number is required.';
  const cleaned = mobile.trim().replace(/[\s\-\(\)\+]/g, '');
  const digits = cleaned.startsWith('91') && cleaned.length === 12 ? cleaned.substring(2) : (cleaned.startsWith('0') && cleaned.length === 11 ? cleaned.substring(1) : cleaned);
  if (!INDIAN_MOBILE_REGEX.test(digits)) {
    return 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210).';
  }
  return null;
}

export function calculatePasswordStrength(password) {
  if (!password) return { score: 0, label: 'None', color: '#cbd5e1', meets: [] };

  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'One uppercase letter (A-Z)', pass: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)', pass: /[a-z]/.test(password) },
    { label: 'One number (0-9)', pass: /[0-9]/.test(password) },
    { label: 'One special character (!@#$...)', pass: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];

  const passedCount = checks.filter(c => c.pass).length;

  let label = 'Weak';
  let color = '#ef4444';

  if (passedCount === 5) {
    label = 'Strong';
    color = '#10b981';
  } else if (passedCount >= 3) {
    label = 'Medium';
    color = '#f59e0b';
  }

  return {
    score: passedCount,
    maxScore: 5,
    label,
    color,
    checks,
  };
}
