# Native Messaging Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native messaging host that reads Copilot auth tokens from macOS Keychain and handles automatic re-authentication.

**Architecture:** Node.js native host communicates with Chrome extension via stdio. Host reads tokens from Keychain (same location as copilot-money-mcp) and handles Playwright/email-link login flows when tokens expire.

**Tech Stack:** Node.js, keytar (Keychain), Playwright (browser automation), Chrome native messaging API

---

## File Structure

**New files:**
- `native-host/package.json` - Node.js project with keytar + playwright deps
- `native-host/index.js` - Entry point, stdio message handler (GET_TOKEN, LOGIN, STATUS)
- `native-host/keychain.js` - Read/write tokens via keytar
- `native-host/login/playwright.js` - Headless browser login with request interception
- `native-host/login/email-link.js` - Firebase email-link fallback with local HTTP server
- `native-host/install.sh` - Register native messaging manifest with browser

**Modified files:**
- `manifest.json` - Add nativeMessaging + notifications permissions
- `src/background.js` - Add native messaging integration, auth mode handling, token expiry checking
- `src/popup.js` - Add new status states (setup required, authenticating, manual mode)
- `src/popup.html` - Add UI elements for new states
- `styles/popup.css` - Add styles for new states

---

### Task 1: Native Host Package Setup

**Files:**
- Create: `native-host/package.json`

- [ ] **Step 1: Create native-host directory**

```bash
mkdir -p native-host/login
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "copilot-budget-overlay-native-host",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "bin": {
    "copilot-native-host": "./index.js"
  },
  "dependencies": {
    "keytar": "^7.9.0",
    "playwright": "^1.40.0"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add native-host/package.json
git commit -m "feat(native-host): initialize package with keytar and playwright deps"
```

---

### Task 2: Keychain Module

**Files:**
- Create: `native-host/keychain.js`

- [ ] **Step 1: Create keychain.js with read/write functions**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add native-host/keychain.js
git commit -m "feat(native-host): add keychain module for token storage"
```

---

### Task 3: Playwright Login Module

**Files:**
- Create: `native-host/login/playwright.js`

- [ ] **Step 1: Create playwright.js with browser automation login**

```javascript
// native-host/login/playwright.js
// Playwright-based login - intercepts GraphQL requests to capture token

import { chromium } from 'playwright';
import { saveToken } from '../keychain.js';

const COPILOT_URL = 'https://app.copilot.money';
const GRAPHQL_URL = 'https://api.copilot.money/graphql';
const TOKEN_TTL = 3600000; // 1 hour

/**
 * Check if Playwright is available
 * @returns {Promise<boolean>}
 */
export async function isAvailable() {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Login via Playwright browser automation
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise<{token: string, expiresAt: number}>}
 */
export async function login(onProgress) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  let capturedToken = null;

  // Intercept requests to capture token
  page.on('request', (request) => {
    if (request.url().startsWith(GRAPHQL_URL)) {
      const auth = request.headers()['authorization'];
      if (auth?.startsWith('Bearer ')) {
        capturedToken = auth.slice(7);
      }
    }
  });

  onProgress?.({ type: 'LOGIN_STARTED', method: 'playwright' });

  await page.goto(COPILOT_URL);

  // Wait for user to complete login and for a GraphQL request with token
  const timeout = 5 * 60 * 1000; // 5 minute timeout
  const startTime = Date.now();

  while (!capturedToken && Date.now() - startTime < timeout) {
    await page.waitForTimeout(500);
  }

  await browser.close();

  if (!capturedToken) {
    throw new Error('Login timed out - no token captured');
  }

  const expiresAt = Date.now() + TOKEN_TTL;
  await saveToken(capturedToken, expiresAt);

  return { token: capturedToken, expiresAt };
}
```

- [ ] **Step 2: Commit**

```bash
git add native-host/login/playwright.js
git commit -m "feat(native-host): add playwright login with request interception"
```

---

### Task 4: Email-Link Login Module

**Files:**
- Create: `native-host/login/email-link.js`

**Note:** Email-link login requires a Firebase API key. Extract from copilot-money-mcp:
```bash
grep -r "AIza" ~/dev/personal/copilot-mcp/src/ | head -1
```
Replace the placeholder below with the actual key.

- [ ] **Step 1: Create email-link.js with HTTP callback server**

```javascript
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
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Email login timed out'));
    }, 5 * 60 * 1000);

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
                query: `mutation { loginWithFirebase(token: "${idToken}") { accessToken } }`,
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
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add native-host/login/email-link.js
git commit -m "feat(native-host): add email-link login fallback"
```

---

### Task 5: Native Host Entry Point

**Files:**
- Create: `native-host/index.js`

- [ ] **Step 1: Create index.js with stdio message handler**

```javascript
#!/usr/bin/env node
// native-host/index.js
// Native messaging host entry point - handles stdio communication

import { getToken, isExpired } from './keychain.js';
import * as playwright from './login/playwright.js';
import * as emailLink from './login/email-link.js';

const VERSION = '1.0.0';

/**
 * Read a native message from stdin
 * Native messaging uses 4-byte length prefix (little-endian)
 */
function readMessage() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let messageLength = null;

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        if (messageLength === null && buffer.length >= 4) {
          messageLength = buffer.readUInt32LE(0);
        }

        if (messageLength !== null && buffer.length >= 4 + messageLength) {
          const messageBuffer = buffer.slice(4, 4 + messageLength);
          try {
            resolve(JSON.parse(messageBuffer.toString()));
          } catch (e) {
            reject(new Error('Invalid JSON message'));
          }
          return;
        }
      }
    });

    process.stdin.on('end', () => {
      reject(new Error('stdin closed'));
    });
  });
}

/**
 * Write a native message to stdout
 */
function writeMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json);
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buffer.length, 0);
  process.stdout.write(header);
  process.stdout.write(buffer);
}

/**
 * Handle GET_TOKEN message
 */
async function handleGetToken() {
  const tokenData = await getToken();

  if (!tokenData) {
    return { type: 'NO_TOKEN' };
  }

  if (isExpired(tokenData.expiresAt)) {
    return { type: 'TOKEN_EXPIRED', expiresAt: tokenData.expiresAt };
  }

  return { type: 'TOKEN', token: tokenData.token, expiresAt: tokenData.expiresAt };
}

/**
 * Handle LOGIN message
 */
async function handleLogin() {
  const progress = (msg) => writeMessage(msg);

  // Try Playwright first
  if (await playwright.isAvailable()) {
    try {
      const result = await playwright.login(progress);
      return { type: 'LOGIN_SUCCESS', token: result.token, expiresAt: result.expiresAt };
    } catch (error) {
      // Fall through to email-link
    }
  }

  // Fall back to email-link
  // For now, we don't have cached email - return error
  // In full implementation, we'd prompt or use cached email
  return { type: 'LOGIN_FAILED', error: 'Email login not yet implemented - use Playwright' };
}

/**
 * Handle STATUS message
 */
async function handleStatus() {
  const playwrightAvailable = await playwright.isAvailable();
  return { type: 'STATUS_OK', version: VERSION, playwrightAvailable };
}

/**
 * Main entry point
 */
async function main() {
  try {
    const message = await readMessage();
    let response;

    switch (message.type) {
      case 'GET_TOKEN':
        response = await handleGetToken();
        break;
      case 'LOGIN':
        response = await handleLogin();
        break;
      case 'STATUS':
        response = await handleStatus();
        break;
      default:
        response = { type: 'ERROR', error: `Unknown message type: ${message.type}` };
    }

    writeMessage(response);
  } catch (error) {
    writeMessage({ type: 'ERROR', error: error.message });
  }

  process.exit(0);
}

main();
```

- [ ] **Step 2: Make index.js executable**

```bash
chmod +x native-host/index.js
```

- [ ] **Step 3: Commit**

```bash
git add native-host/index.js
git commit -m "feat(native-host): add entry point with stdio message handling"
```

---

### Task 6: Install Script

**Files:**
- Create: `native-host/install.sh`

- [ ] **Step 1: Create install.sh**

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_PATH="$SCRIPT_DIR/index.js"

# Parse arguments
EXTENSION_ID=""
BROWSER="arc"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --extension-id=*) EXTENSION_ID="${1#*=}"; shift ;;
    arc|chrome|chromium) BROWSER="$1"; shift ;;
    *) echo "Usage: ./install.sh [--extension-id=ID] [arc|chrome|chromium]"; exit 1 ;;
  esac
done

if [[ -z "$EXTENSION_ID" ]]; then
  echo "Error: --extension-id is required"
  echo ""
  echo "To find your extension ID:"
  echo "  1. Load the extension in your browser (chrome://extensions)"
  echo "  2. Enable 'Developer mode'"
  echo "  3. Copy the ID shown under the extension name"
  echo ""
  echo "Usage: ./install.sh --extension-id=abcdefghijklmnop [arc|chrome|chromium]"
  exit 1
fi

case "$BROWSER" in
  arc)     MANIFEST_DIR="$HOME/Library/Application Support/Arc/User Data/NativeMessagingHosts" ;;
  chrome)  MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" ;;
  chromium) MANIFEST_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts" ;;
esac

mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_DIR/com.copilot.budget_overlay.json" << EOF
{
  "name": "com.copilot.budget_overlay",
  "description": "Copilot Budget Overlay Native Host",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
EOF

echo "✓ Installed native messaging manifest to $MANIFEST_DIR"
echo ""
echo "Next steps:"
echo "  cd $SCRIPT_DIR && npm install"
echo ""
echo "Then reload the extension in your browser."
```

- [ ] **Step 2: Make install.sh executable**

```bash
chmod +x native-host/install.sh
```

- [ ] **Step 3: Commit**

```bash
git add native-host/install.sh
git commit -m "feat(native-host): add install script for browser registration"
```

---

### Task 7: Update Extension Manifest

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Add nativeMessaging and notifications permissions**

Add `"nativeMessaging"` and `"notifications"` to the permissions array in `manifest.json`:

```json
"permissions": [
  "storage",
  "activeTab",
  "nativeMessaging",
  "notifications"
],
```

- [ ] **Step 2: Commit**

```bash
git add manifest.json
git commit -m "feat(extension): add nativeMessaging and notifications permissions"
```

---

### Task 8: Background Worker - Native Messaging Integration

**Files:**
- Modify: `src/background.js`

- [ ] **Step 1: Add native messaging constants and state at top of file**

After the existing cache variables (around line 20), add:

```javascript
// Native messaging
const NATIVE_HOST = 'com.copilot.budget_overlay';
let authMode = 'unknown'; // 'native' | 'manual' | 'unknown'
let loginInProgress = false;
let nativeTokenExpiresAt = 0;
```

- [ ] **Step 2: Add native messaging helper function**

After the existing `getTokens()` function, add:

```javascript
/**
 * Send native message and await response
 */
function sendNativeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
```

- [ ] **Step 3: Add auth initialization function**

```javascript
/**
 * Initialize auth - check for native host, fall back to manual
 */
async function initAuth() {
  try {
    const status = await sendNativeMessage({ type: 'STATUS' });
    if (status.type === 'STATUS_OK') {
      authMode = 'native';
      const tokenResponse = await sendNativeMessage({ type: 'GET_TOKEN' });
      await handleNativeTokenResponse(tokenResponse);
    }
  } catch (err) {
    // Native host not installed - fall back to manual token entry
    authMode = 'manual';
  }
}

/**
 * Handle token response from native host
 */
async function handleNativeTokenResponse(response) {
  if (response.type === 'TOKEN') {
    // Store token in chrome.storage for existing code to use
    await chrome.storage.local.set({ copilotToken: response.token });
    nativeTokenExpiresAt = response.expiresAt;
  } else if (response.type === 'NO_TOKEN' || response.type === 'TOKEN_EXPIRED') {
    // Need to authenticate - trigger login
    await triggerNativeLogin();
  }
}

/**
 * Trigger native login with mutex
 */
async function triggerNativeLogin() {
  if (loginInProgress) return;
  loginInProgress = true;

  chrome.notifications.create('copilot-auth', {
    type: 'basic',
    iconUrl: 'icons/icon-48.png',
    title: 'Copilot Budget',
    message: 'Authenticating...',
  });

  try {
    const result = await sendNativeMessage({ type: 'LOGIN' });

    if (result.type === 'LOGIN_SUCCESS') {
      await chrome.storage.local.set({ copilotToken: result.token });
      nativeTokenExpiresAt = result.expiresAt;

      chrome.notifications.create('copilot-auth-success', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Copilot Budget',
        message: 'Authenticated successfully',
      });
    } else if (result.type === 'LOGIN_EMAIL_SENT') {
      chrome.notifications.create('copilot-auth-email', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Copilot Budget',
        message: 'Check your email to complete login',
        requireInteraction: true,
      });
    } else if (result.type === 'LOGIN_FAILED') {
      chrome.notifications.create('copilot-auth-failed', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Copilot Budget',
        message: `Authentication failed: ${result.error}`,
      });
    }
  } finally {
    loginInProgress = false;
  }
}

/**
 * Check token expiry and refresh if needed
 */
async function checkTokenExpiry() {
  if (authMode === 'native' && nativeTokenExpiresAt > 0) {
    // Refresh 5 minutes before expiry
    if (nativeTokenExpiresAt < Date.now() + 5 * 60 * 1000) {
      await triggerNativeLogin();
    }
  }
}
```

- [ ] **Step 4: Update getTokens to prefer native token**

Replace the existing `getTokens` function:

```javascript
/**
 * Get stored tokens - from native host or manual storage
 */
async function getTokens() {
  // If native auth mode and we have a non-expired token, refresh from native
  if (authMode === 'native' && nativeTokenExpiresAt > Date.now()) {
    try {
      const response = await sendNativeMessage({ type: 'GET_TOKEN' });
      if (response.type === 'TOKEN') {
        await chrome.storage.local.set({ copilotToken: response.token });
        nativeTokenExpiresAt = response.expiresAt;
      }
    } catch {
      // Fall through to storage
    }
  }

  const result = await chrome.storage.local.get(['copilotToken', 'claudeKey']);
  return {
    copilotToken: result.copilotToken || null,
    claudeKey: result.claudeKey || null,
  };
}
```

- [ ] **Step 5: Add new message handlers and update onInstalled**

Add to the message listener (before the `return false` at the end):

```javascript
if (type === 'GET_AUTH_STATUS') {
  const status = {
    authMode,
    nativeTokenExpiresAt,
    loginInProgress,
  };
  sendResponse(status);
  return true;
}

if (type === 'TRIGGER_LOGIN') {
  if (authMode === 'native') {
    triggerNativeLogin().then(() => sendResponse({ success: true }));
  } else {
    sendResponse({ error: 'Native host not available' });
  }
  return true;
}
```

**Note:** The existing `GET_STATUS` handler is preserved - it already exists in background.js and will continue to work.
```

Update the onInstalled listener:

```javascript
// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Copilot Budget Overlay installed');
  initAuth();
});

// Also init on startup
chrome.runtime.onStartup.addListener(() => {
  initAuth();
});

// Check token expiry every minute
chrome.alarms.create('check-token-expiry', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check-token-expiry') {
    checkTokenExpiry();
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add src/background.js
git commit -m "feat(extension): add native messaging integration to background worker"
```

---

### Task 9: Update Popup UI

**Files:**
- Modify: `src/popup.html`
- Modify: `src/popup.js`
- Modify: `styles/popup.css`

- [ ] **Step 1: Update popup.html with new status states**

Replace the content of `src/popup.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="styles/popup.css">
</head>
<body>
  <div class="popup">
    <div class="popup__header">
      <h1 class="popup__title">Copilot Budget</h1>
    </div>

    <div class="popup__status" id="status">
      <div class="popup__status-icon" id="status-icon"></div>
      <div class="popup__status-text" id="status-text">Checking...</div>
      <div class="popup__status-detail" id="status-detail"></div>
    </div>

    <div class="popup__setup" id="setup-instructions" style="display: none;">
      <p class="popup__setup-text">To enable automatic authentication, install the native helper:</p>
      <code class="popup__setup-code" id="setup-code"></code>
      <button class="popup__button popup__button--small" id="copy-cmd-btn">Copy</button>
    </div>

    <div class="popup__actions">
      <button class="popup__button" id="settings-btn">Settings</button>
      <button class="popup__button popup__button--secondary" id="refresh-btn">Refresh</button>
      <button class="popup__button popup__button--secondary" id="login-btn" style="display: none;">Login</button>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Update popup.js with auth status handling**

Replace the content of `src/popup.js`:

```javascript
// src/popup.js
// Popup logic: status display, auth status, settings link

async function checkStatus() {
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const statusDetail = document.getElementById('status-detail');
  const setupInstructions = document.getElementById('setup-instructions');
  const loginBtn = document.getElementById('login-btn');

  try {
    // Get auth status
    const authStatus = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' });

    // Get connection status
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

    if (authStatus.loginInProgress) {
      statusIcon.className = 'popup__status-icon popup__status-icon--loading';
      statusText.textContent = 'Authenticating...';
      statusDetail.textContent = 'Logging in via browser';
      loginBtn.style.display = 'none';
      setupInstructions.style.display = 'none';
      return;
    }

    if (authStatus.authMode === 'native') {
      if (response.connected) {
        statusIcon.className = 'popup__status-icon popup__status-icon--connected';
        statusText.textContent = 'Connected';

        if (authStatus.nativeTokenExpiresAt > 0) {
          const mins = Math.round((authStatus.nativeTokenExpiresAt - Date.now()) / 60000);
          statusDetail.textContent = mins > 0 ? `Token expires in ${mins}m` : 'Token expired';
        } else {
          statusDetail.textContent = '';
        }

        loginBtn.style.display = 'none';
        setupInstructions.style.display = 'none';
      } else {
        statusIcon.className = 'popup__status-icon popup__status-icon--warning';
        statusText.textContent = 'Not authenticated';
        statusDetail.textContent = '';
        loginBtn.style.display = 'inline-block';
        setupInstructions.style.display = 'none';
      }
    } else if (authStatus.authMode === 'manual') {
      if (response.connected) {
        statusIcon.className = 'popup__status-icon popup__status-icon--connected';
        statusText.textContent = 'Connected (Manual)';
        statusDetail.textContent = 'Using manually entered token';
      } else {
        statusIcon.className = 'popup__status-icon popup__status-icon--disconnected';
        statusText.textContent = 'Not configured';
        statusDetail.textContent = '';
      }
      loginBtn.style.display = 'none';
      setupInstructions.style.display = 'block';
    } else {
      // Unknown auth mode - still initializing
      statusIcon.className = 'popup__status-icon popup__status-icon--loading';
      statusText.textContent = 'Initializing...';
      statusDetail.textContent = '';
      loginBtn.style.display = 'none';
      setupInstructions.style.display = 'none';
    }
  } catch (error) {
    statusIcon.className = 'popup__status-icon popup__status-icon--disconnected';
    statusText.textContent = 'Error';
    statusDetail.textContent = error.message;
  }
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

async function refreshCache() {
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.textContent = 'Refreshing...';
  refreshBtn.disabled = true;

  try {
    await chrome.runtime.sendMessage({ type: 'REFRESH_CACHE' });
    await checkStatus();
  } finally {
    refreshBtn.textContent = 'Refresh';
    refreshBtn.disabled = false;
  }
}

async function triggerLogin() {
  const loginBtn = document.getElementById('login-btn');
  loginBtn.textContent = 'Logging in...';
  loginBtn.disabled = true;

  try {
    await chrome.runtime.sendMessage({ type: 'TRIGGER_LOGIN' });
    // Poll for status changes
    const pollStatus = setInterval(async () => {
      await checkStatus();
      const authStatus = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' });
      if (!authStatus.loginInProgress) {
        clearInterval(pollStatus);
        loginBtn.textContent = 'Login';
        loginBtn.disabled = false;
      }
    }, 1000);
  } catch {
    loginBtn.textContent = 'Login';
    loginBtn.disabled = false;
  }
}

function getInstallCommand() {
  const extensionId = chrome.runtime.id;
  return `cd native-host && ./install.sh --extension-id=${extensionId} && npm install`;
}

function copyCommand() {
  navigator.clipboard.writeText(getInstallCommand());
  const copyBtn = document.getElementById('copy-cmd-btn');
  copyBtn.textContent = 'Copied!';
  setTimeout(() => {
    copyBtn.textContent = 'Copy';
  }, 2000);
}

// Set up dynamic install command
document.getElementById('setup-code').textContent = getInstallCommand();

document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('refresh-btn').addEventListener('click', refreshCache);
document.getElementById('login-btn').addEventListener('click', triggerLogin);
document.getElementById('copy-cmd-btn').addEventListener('click', copyCommand);

// Check status on load
checkStatus();
```

- [ ] **Step 3: Update popup.css with new styles**

Add the following to `styles/popup.css`:

```css
.popup__status-detail {
  font-size: 11px;
  color: #666;
  margin-top: 4px;
}

.popup__status-icon--loading {
  width: 12px;
  height: 12px;
  border: 2px solid #ddd;
  border-top-color: #4caf50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.popup__status-icon--warning {
  width: 12px;
  height: 12px;
  background: #ff9800;
  border-radius: 50%;
}

.popup__setup {
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
  margin-bottom: 12px;
}

.popup__setup-text {
  font-size: 12px;
  color: #333;
  margin-bottom: 8px;
}

.popup__setup-code {
  display: block;
  font-family: monospace;
  font-size: 11px;
  background: #fff;
  padding: 8px;
  border-radius: 4px;
  word-break: break-all;
  margin-bottom: 8px;
}

.popup__button--small {
  padding: 6px 12px;
  font-size: 12px;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/popup.html src/popup.js styles/popup.css
git commit -m "feat(extension): update popup with native auth status display"
```

---

### Task 10: Build and Test

**Files:**
- No new files

- [ ] **Step 1: Install native host dependencies**

```bash
cd native-host && npm install
```

- [ ] **Step 2: Build extension**

```bash
npm run build
```

- [ ] **Step 3: Load extension in browser**

1. Open `chrome://extensions` (or `arc://extensions`)
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` folder
4. Note the extension ID

- [ ] **Step 4: Install native host**

```bash
cd native-host && ./install.sh --extension-id=YOUR_EXTENSION_ID
```

- [ ] **Step 5: Test native messaging**

1. Click the extension icon
2. Should show "Initializing..." then "Not authenticated" (if no token in Keychain)
3. Click "Login" - should open Playwright browser
4. Complete login in browser
5. After login, popup should show "Connected" with token expiry time

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during testing"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Verify graceful fallback**

1. Uninstall native host manifest
2. Reload extension
3. Popup should show "Not configured" with setup instructions
4. Manual token entry in settings should still work

- [ ] **Step 2: Verify token expiry notification**

1. With native host installed and authenticated
2. Wait for token to approach expiry (or manually edit Keychain)
3. Should see re-authentication notification

- [ ] **Step 3: Create final commit**

```bash
git add -A
git commit -m "feat: complete native messaging host integration"
```
