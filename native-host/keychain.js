// native-host/keychain.js
// Keychain access - reads from copilot-auth daemon's shared keychain location

import keytar from 'keytar';

const SERVICE = 'copilot-money-auth';
const ACCOUNT = 'token';

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

  return { token, expiresAt };
}

export function isExpired(expiresAt) {
  return Date.now() >= expiresAt;
}
