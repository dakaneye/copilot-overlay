// native-host/login/email-link.js
// Email-link login fallback - starts local HTTP server to receive callback

import { createServer } from 'node:http';
import { URL } from 'node:url';
import { saveToken } from '../keychain.js';

const FIREBASE_API = 'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode';
const COPILOT_GRAPHQL = 'https://api.copilot.money/graphql';
const TOKEN_TTL = 3600000; // 1 hour

// Extract this from copilot-money-mcp: grep -r "AIza" ~/dev/personal/copilot-mcp/src/
const FIREBASE_API_KEY = 'REPLACE_WITH_ACTUAL_KEY';

/**
 * Get a random available port
 * @returns {Promise<number>}
 */
async function getAvailablePort() {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Login via email link
 * @param {string} email - User's email address
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise<{token: string, expiresAt: number}>}
 */
export async function login(email, onProgress) {
  const port = await getAvailablePort();
  const callbackUrl = `http://localhost:${port}/callback`;

  // Send email link request
  const sendResponse = await fetch(`${FIREBASE_API}?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'EMAIL_SIGNIN',
      email,
      continueUrl: callbackUrl,
    }),
  });

  if (!sendResponse.ok) {
    throw new Error('Failed to send email link');
  }

  onProgress?.({ type: 'LOGIN_EMAIL_SENT', email });

  // Start HTTP server to wait for callback
  return new Promise((resolve, reject) => {
    let timeout;

    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);

      if (url.pathname === '/callback') {
        const oobCode = url.searchParams.get('oobCode');

        if (oobCode) {
          try {
            // Exchange oobCode for Firebase ID token
            const verifyResponse = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=${FIREBASE_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, oobCode }),
              }
            );

            const { idToken } = await verifyResponse.json();

            // Exchange Firebase token for Copilot token
            const copilotResponse = await fetch(COPILOT_GRAPHQL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: `mutation LoginWithFirebase($token: String!) { loginWithFirebase(token: $token) { accessToken } }`,
                variables: { token: idToken },
              }),
            });

            const { data } = await copilotResponse.json();
            const token = data.loginWithFirebase.accessToken;
            const expiresAt = Date.now() + TOKEN_TTL;

            await saveToken(token, expiresAt);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Login successful!</h1><p>You can close this window.</p></body></html>');

            clearTimeout(timeout);
            server.close();
            resolve({ token, expiresAt });
          } catch (error) {
            res.writeHead(500);
            res.end('Login failed');
            clearTimeout(timeout);
            server.close();
            reject(error);
          }
        }
      }
    });

    server.listen(port);

    timeout = setTimeout(() => {
      server.close();
      reject(new Error('Email login timed out'));
    }, 5 * 60 * 1000);
  });
}
