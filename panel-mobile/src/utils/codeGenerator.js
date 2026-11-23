// Utility: Code Generator for Admin Join Codes

/**
 * Generate a unique admin join code
 * Format: XX-XXXXXX (prefix + 6 alphanumeric chars)
 */
export function generateJoinCode() {
  const prefixes = ['TF', 'BZ', 'CP', 'MG', 'PN', 'WK', 'ST', 'OP'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous: 0,O,1,I
  let code = '';
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  for (let i = 0; i < 6; i++) {
    code += chars[array[i] % chars.length];
  }
  return `${prefix}-${code}`;
}

/**
 * Generate a unique ID using crypto
 */
export function generateId(prefix = '') {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars[array[i] % chars.length];
  }
  return prefix ? `${prefix}_${id}` : id;
}
