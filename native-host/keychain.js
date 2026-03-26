// native-host/keychain.js
// Keychain access using keytar - same service as copilot-money-mcp

import keytar from 'keytar';

const SERVICE = 'copilot-money-mcp';
const ACCOUNT_TOKEN = 'access_token';
const ACCOUNT_EXPIRES = 'expires_at';

/**
 * Get token and expiry from Keychain
 * @returns {Promise<{token: string, expiresAt: number} | null>}
 */
export async function getToken() {
  const token = await keytar.getPassword(SERVICE, ACCOUNT_TOKEN);
  const expiresAtStr = await keytar.getPassword(SERVICE, ACCOUNT_EXPIRES);

  if (!token) {
    return null;
  }

  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;

  // Validate expiry is a reasonable timestamp (not NaN, not negative, not impossibly old)
  const minValidTimestamp = Date.now() - 365 * 24 * 60 * 60 * 1000; // 1 year ago
  if (Number.isNaN(expiresAt) || expiresAt < minValidTimestamp) {
    return { token, expiresAt: 0 }; // Treat as expired
  }

  return { token, expiresAt };
}

/**
 * Save token and expiry to Keychain
 * @param {string} token
 * @param {number} expiresAt
 */
export async function saveToken(token, expiresAt) {
  await keytar.setPassword(SERVICE, ACCOUNT_TOKEN, token);
  await keytar.setPassword(SERVICE, ACCOUNT_EXPIRES, String(expiresAt));
}

/**
 * Check if token is expired
 * @param {number} expiresAt
 * @returns {boolean}
 */
export function isExpired(expiresAt) {
  return Date.now() >= expiresAt;
}
