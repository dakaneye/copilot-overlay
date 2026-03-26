// native-host/keychain.js
// Keychain access using keytar - same service as copilot-money-mcp

import keytar from 'keytar';

const SERVICE = 'copilot-money-mcp';
const ACCOUNT_TOKEN = 'access_token';
const ACCOUNT_EXPIRES = 'expires_at';

const MAX_TOKEN_AGE_MS = 365 * 24 * 60 * 60 * 1000; // Reject timestamps older than 1 year

export async function getToken() {
  const [token, expiresAtStr] = await Promise.all([
    keytar.getPassword(SERVICE, ACCOUNT_TOKEN),
    keytar.getPassword(SERVICE, ACCOUNT_EXPIRES),
  ]);

  if (!token) {
    return null;
  }

  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
  const minValidTimestamp = Date.now() - MAX_TOKEN_AGE_MS;
  if (Number.isNaN(expiresAt) || expiresAt < minValidTimestamp) {
    return { token, expiresAt: 0 }; // Treat as expired
  }

  return { token, expiresAt };
}

export async function saveToken(token, expiresAt) {
  await Promise.all([
    keytar.setPassword(SERVICE, ACCOUNT_TOKEN, token),
    keytar.setPassword(SERVICE, ACCOUNT_EXPIRES, String(expiresAt)),
  ]);
}

export function isExpired(expiresAt) {
  return Date.now() >= expiresAt;
}
