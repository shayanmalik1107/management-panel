// Utility: Form Validators

export function validateEmail(email) {
  if (!email) return 'Email is required';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Please enter a valid email address';
  return null;
}

export function validatePassword(password) {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
}

export function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} is required`;
  }
  return null;
}

export function validatePositiveNumber(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`;
  }
  const num = Number(value);
  if (isNaN(num)) return `${fieldName} must be a number`;
  if (num < 0) return `${fieldName} cannot be negative`;
  return null;
}

export function validateGreaterThanZero(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`;
  }
  const num = Number(value);
  if (isNaN(num)) return `${fieldName} must be a number`;
  if (num <= 0) return `${fieldName} must be greater than 0`;
  return null;
}

export function validatePhone(phone) {
  if (!phone) return null; // Phone is often optional
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.length < 7 || cleaned.length > 15) {
    return 'Please enter a valid phone number';
  }
  return null;
}

export function validateAdminCode(code) {
  if (!code) return 'Admin code is required';
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z]{2}-[A-Z0-9]{6}$/.test(cleaned)) {
    return 'Invalid code format. Example: TF-X72K91';
  }
  return null;
}

/**
 * Translate Firebase auth error codes to user-friendly messages
 */
export function getAuthErrorMessage(errorCode) {
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
  const messages = {
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled. Contact support.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/popup-blocked': 'Sign-in popup was blocked by your browser. Trying redirect...',
    'auth/cancelled-popup-request': 'Only one sign-in request is allowed at a time.',
    'auth/invalid-credential': 'Invalid credentials. Please try again.',
    'auth/operation-not-allowed': 'Google sign-in is not enabled in Firebase Authentication Console.',
    'auth/unauthorized-domain': `Domain '${currentHost}' is not authorized. Please add '${currentHost}' to Firebase Console -> Authentication -> Settings -> Authorized Domains.`,
    'auth/account-exists-with-different-credential': 'An account already exists with this email using another login method.',
  };
  return messages[errorCode] || (errorCode ? `Authentication error (${errorCode})` : 'An error occurred. Please try again.');
}
