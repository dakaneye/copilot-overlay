// native-host/keychain.js
// Keychain access - reads from copilot-auth daemon's shared keychain location

const SERVICE = 'copilot-money-auth';
const ACCOUNT = 'token';

// Dynamic import - keytar may not be available on all platforms
let keytar = null;
try {
  keytar = (await import('keytar')).default;
} catch {
  // keytar unavailable (CI, missing native deps)
}

export async function getToken() {
  if (!keytar) {
    return null;
  }

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

export function isKeychainAvailable() {
  return keytar !== null;
}
