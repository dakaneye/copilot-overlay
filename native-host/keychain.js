// native-host/keychain.js
// Keychain access - reads from copilot-auth daemon's shared keychain location

import keytar from 'keytar';

const SERVICE = 'copilot-money-auth';
const ACCOUNT = 'token';

const MAX_TOKEN_AGE_MS = 365 * 24 * 60 * 60 * 1000; // Reject timestamps older than 1 year

export async function getToken() {
  const tokenJson = await keytar.getPassword(SERVICE, ACCOUNT);

  if (!tokenJson) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(tokenJson);
  } catch {
    return null; // Invalid JSON
  }

  const { token, expiresAt } = parsed;
  if (!token || typeof expiresAt !== 'number') {
    return null; // Missing required fields
  }

  const minValidTimestamp = Date.now() - MAX_TOKEN_AGE_MS;
  if (Number.isNaN(expiresAt) || expiresAt < minValidTimestamp) {
    return { token, expiresAt: 0 }; // Treat as expired
  }

  return { token, expiresAt };
}

// DEPRECATED: Daemon handles token storage now
// Kept temporarily for login modules that will be removed in next task
export async function saveToken(token, expiresAt) {
  // No-op: daemon writes to keychain directly
  return;
}

export function isExpired(expiresAt) {
  return Date.now() >= expiresAt;
}
