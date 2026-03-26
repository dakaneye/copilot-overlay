// native-host/login/email-link.js
// Email-link login fallback - starts local HTTP server to receive callback

import { createServer } from 'node:http';
import { URL } from 'node:url';
import { saveToken } from '../keychain.js';
import { TOKEN_TTL } from '../constants.js';

const FIREBASE_API = 'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode';
const COPILOT_GRAPHQL = 'https://api.copilot.money/graphql';

const FIREBASE_API_KEY = process.env.COPILOT_FIREBASE_API_KEY;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function isAvailable() {
  return Boolean(FIREBASE_API_KEY);
}

async function getAvailablePort() {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(email, onProgress) {
  if (!FIREBASE_API_KEY) {
    throw new Error('Firebase configuration required. Set COPILOT_FIREBASE_API_KEY environment variable.');
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    throw new Error('Valid email address required');
  }

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

            if (!verifyResponse.ok) {
              throw new Error(`Firebase verification failed: ${verifyResponse.status}`);
            }

            const verifyData = await verifyResponse.json();
            if (!verifyData.idToken) {
              throw new Error('Firebase response missing idToken');
            }

            const copilotResponse = await fetch(COPILOT_GRAPHQL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: `mutation LoginWithFirebase($token: String!) { loginWithFirebase(token: $token) { accessToken } }`,
                variables: { token: verifyData.idToken },
              }),
            });

            if (!copilotResponse.ok) {
              throw new Error(`Copilot API failed: ${copilotResponse.status}`);
            }

            const copilotData = await copilotResponse.json();
            if (!copilotData.data?.loginWithFirebase?.accessToken) {
              throw new Error('Copilot response missing accessToken');
            }

            const token = copilotData.data.loginWithFirebase.accessToken;
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

    server.listen(port, '127.0.0.1');

    timeout = setTimeout(() => {
      server.close();
      reject(new Error('Email login timed out'));
    }, LOGIN_TIMEOUT_MS);
  });
}
