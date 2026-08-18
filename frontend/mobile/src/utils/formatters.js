/**
 * Format an Indian phone number for display (e.g. +91 98765 43210)
 */
export function formatIndianMobileDisplay(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+91') && cleaned.length === 13) {
    return `+91 ${cleaned.slice(3, 8)} ${cleaned.slice(8)}`;
  }
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
}

/**
 * Mask mobile number for safe privacy display (e.g. +91 ******3210)
 */
export function maskMobileDisplay(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/[^\d]/g, '');
  if (cleaned.length >= 10) {
    const last4 = cleaned.slice(-4);
    return `+91 ******${last4}`;
  }
  return phone;
}

/**
 * Mask email address for privacy display (e.g. resident@example.com -> r***t@example.com)
 */
export function maskEmailDisplay(email) {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

/**
 * Format timestamps into friendly Indian local date/time strings
 */
export function formatDate(isoString) {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
