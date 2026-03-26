# Native Messaging Host Design

## Overview

Add a native messaging host to the Copilot Budget Overlay extension that reads auth tokens from macOS Keychain and handles automatic re-authentication when tokens expire.

## Goals

- Automatically read Copilot tokens from Keychain (same location as copilot-money-mcp)
- Background re-authentication via Playwright when tokens expire
- Email-link fallback when Playwright unavailable
- Graceful fallback to manual token entry if native host not installed

## Scope

- **Platform:** macOS only (uses Keychain and Arc/Chrome paths)
- **Execution model:** Stateless - each native message spawns a new process
- **Reference implementation:** Login flows based on `copilot-money-mcp` (~/dev/personal/copilot-mcp)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Chrome Extension                                             │
│  ┌──────────┐    ┌────────────┐    ┌──────────────────────┐ │
│  │ Content  │───>│ Background │───>│ Native Messaging API │ │
│  │ Script   │    │ Worker     │    └──────────┬───────────┘ │
└──────────────────────────────────────────────┼──────────────┘
                                               │ stdio
┌──────────────────────────────────────────────▼──────────────┐
│ Native Host (Node.js)                                        │
│  ┌──────────┐    ┌───────────┐    ┌─────────────────────┐   │
│  │ Message  │───>│ Keychain  │───>│ macOS Keychain      │   │
│  │ Handler  │    │ (keytar)  │    │ (copilot-money-mcp) │   │
│  │          │    └───────────┘    └─────────────────────┘   │
│  │          │    ┌───────────┐                              │
│  │          │───>│ Login     │──> Playwright (background)   │
│  │          │    │ Module    │──> Email-link (fallback)     │
│  └──────────┘    └───────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
copilot-overlay/
├── native-host/
│   ├── package.json
│   ├── index.js              # Entry point, stdio message handler
│   ├── keychain.js           # Read/write tokens via keytar
│   ├── login/
│   │   ├── playwright.js     # Browser automation login
│   │   └── email-link.js     # Fallback email auth
│   ├── manifest.json         # Native messaging manifest template
│   └── install.sh            # Registers manifest with browser
```

## Message Protocol

### GET_TOKEN

Retrieve current token from Keychain.

```json
// Request
{ "type": "GET_TOKEN" }

// Response (success)
{ "type": "TOKEN", "token": "eyJ...", "expiresAt": 1711382400000 }

// Response (not found)
{ "type": "NO_TOKEN" }

// Response (expired)
{ "type": "TOKEN_EXPIRED", "expiresAt": 1711382400000 }
```

### LOGIN

Trigger re-authentication flow.

```json
// Request
{ "type": "LOGIN" }

// Response (started)
{ "type": "LOGIN_STARTED", "method": "playwright" }

// Response (needs interaction)
{ "type": "LOGIN_EMAIL_SENT", "email": "user@example.com" }

// Response (complete)
{ "type": "LOGIN_SUCCESS", "token": "eyJ...", "expiresAt": 1711382400000 }

// Response (failed)
{ "type": "LOGIN_FAILED", "error": "Playwright not available" }
```

### STATUS

Check native host health.

```json
// Request
{ "type": "STATUS" }

// Response
{ "type": "STATUS_OK", "version": "1.0.0", "playwrightAvailable": true }
```

## Keychain Storage

Uses same service and accounts as copilot-money-mcp for compatibility:

- **Service:** `copilot-money-mcp`
- **Accounts:**
  - `access_token` - JWT bearer token
  - `expires_at` - Unix timestamp (ms) when token expires

**Token expiry:** Copilot tokens expire after ~1 hour. The `expires_at` value is captured during login by recording `Date.now() + 3600000` when the token is intercepted. There is no refresh token mechanism - re-authentication requires a new login flow.

## Extension Integration

### Manifest Changes

Add to `manifest.json`:

```json
{
  "permissions": ["nativeMessaging", "notifications"],
  "background": {
    "service_worker": "background.js"
  }
}
```

### Background Worker Changes

```javascript
const NATIVE_HOST = 'com.copilot.budget_overlay';
let authMode = 'unknown'; // 'native' | 'manual' | 'unknown'
let loginInProgress = false;

// Check for native host on startup
async function initAuth() {
  try {
    const status = await sendNativeMessage({ type: 'STATUS' });
    if (status.type === 'STATUS_OK') {
      authMode = 'native';
      const tokenResponse = await sendNativeMessage({ type: 'GET_TOKEN' });
      handleTokenResponse(tokenResponse);
    }
  } catch (err) {
    // Native host not installed - fall back to manual token entry
    authMode = 'manual';
  }
}

// Handle token response - trigger login if needed
function handleTokenResponse(response) {
  if (response.type === 'TOKEN') {
    setToken(response.token, response.expiresAt);
  } else if (response.type === 'NO_TOKEN' || response.type === 'TOKEN_EXPIRED') {
    // No token - user needs to authenticate
    triggerLogin();
  }
}

// Trigger login with mutex to prevent concurrent attempts
async function triggerLogin() {
  if (loginInProgress) return;
  loginInProgress = true;

  chrome.notifications.create({
    type: 'basic',
    title: 'Copilot',
    message: 'Authenticating...'
  });

  try {
    const result = await sendNativeMessage({ type: 'LOGIN' });
    handleLoginResponse(result);
  } finally {
    loginInProgress = false;
  }
}

// Token refresh check (runs every minute via alarm)
async function checkTokenExpiry() {
  if (authMode === 'native' && tokenExpiresAt < Date.now() + 5 * 60 * 1000) {
    triggerLogin();
  }
}

// Native messaging helper
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

### Graceful Fallback

- Native host available → auto-auth, background refresh
- Native host missing → manual token entry in settings (current behavior)

Extension works either way; native host enables seamless auth.

## Notifications

| Event | Notification |
|-------|--------------|
| Token expiring soon | "Copilot: Re-authenticating..." (silent) |
| Playwright login success | "Copilot: Authenticated" (auto-dismiss) |
| Email-link needed | "Copilot: Check your email to complete login" (stays until clicked) |
| Login failed | "Copilot: Authentication failed - click to retry" |

## Popup States

```
┌─────────────────────────┐    ┌─────────────────────────┐
│ ● Connected             │    │ ○ Setup Required        │
│                         │    │                         │
│ Token expires in 45m    │    │ Native host not found.  │
│                         │    │ [Install Instructions]  │
│ [Settings] [Refresh]    │    │                         │
└─────────────────────────┘    └─────────────────────────┘

┌─────────────────────────┐    ┌─────────────────────────┐
│ ◐ Authenticating...     │    │ ○ Manual Mode           │
│                         │    │                         │
│ Logging in via browser  │    │ Using manually entered  │
│                         │    │ token from settings.    │
│ [Cancel]                │    │ [Settings] [Refresh]    │
└─────────────────────────┘    └─────────────────────────┘
```

## Installation

### Install Script

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

echo "Installed to $MANIFEST_DIR"
echo "Run 'npm install' to install dependencies"
```

### Usage

```bash
# Extension ID is required - find it in chrome://extensions with Developer mode enabled
./install.sh --extension-id=abcdefghijklmnop        # defaults to Arc
./install.sh --extension-id=abcdefghijklmnop chrome # for Chrome
```

### Extension Detection

When native host is not found, extension popup shows:

> **Setup Required**
>
> To enable automatic authentication, install the native helper:
> ```
> cd native-host && ./install.sh && npm install
> ```
>
> [Copy Command] [Use Manual Mode Instead]

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Native host not installed | Extension falls back to manual token mode |
| Native message fails | Each message is a separate process; extension retries on next interval |
| Keychain access denied | Prompt user to grant Keychain access in System Settings |
| Playwright not available | Fall back to email-link auth |
| Email-link timeout (5 min) | Show "Login timed out" notification, offer retry |
| Token in Keychain but expired | Auto-trigger LOGIN flow |
| Login already in progress | Ignore new LOGIN requests (mutex in extension) |

### Keychain Permission

On first run, macOS shows system prompt asking to allow `node` to access Keychain. If denied, extension shows:

> **Keychain Access Required**
>
> Allow "node" to access your Keychain in System Settings → Privacy & Security → Keychain Access

## Login Flow Details

Based on `copilot-money-mcp` implementation in `~/dev/personal/copilot-mcp/src/auth/`.

### Playwright Login (Primary)

```
User clicks Login → Native Host
    │
    ├── Launch headless Chromium (playwright.chromium.launch)
    ├── Navigate to https://app.copilot.money
    ├── Set up request interception for https://api.copilot.money/graphql
    │
    ├── User completes login in automated browser
    │   (Google OAuth, Apple, or email link)
    │
    ├── Intercept GraphQL request with Authorization header
    │   └── Extract: Bearer eyJ...
    │
    ├── Store in Keychain:
    │   ├── access_token = eyJ...
    │   └── expires_at = Date.now() + 3600000
    │
    └── Return LOGIN_SUCCESS to extension
```

**Request interception pattern:**
```javascript
page.on('request', (request) => {
  const auth = request.headers()['authorization'];
  if (auth?.startsWith('Bearer ')) {
    token = auth.slice(7);
  }
});
```

### Email-Link Login (Fallback)

Used when Playwright is unavailable or headless browser fails.

```
User clicks Login → Native Host
    │
    ├── Return LOGIN_EMAIL_SENT with cached email
    │   (prompts user to check email)
    │
    ├── Call Firebase email-link auth endpoint:
    │   POST https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode
    │   Body: { requestType: "EMAIL_SIGNIN", email: "user@example.com" }
    │
    ├── Start local HTTP server on random port (e.g., localhost:54321)
    │   └── Waiting for redirect callback
    │
    ├── User clicks email link → redirects to localhost:54321/?token=...
    │
    ├── Extract token from callback URL
    │
    ├── Exchange Firebase token for Copilot session:
    │   POST https://api.copilot.money/graphql
    │   mutation { loginWithFirebase(token: "...") { accessToken } }
    │
    ├── Store in Keychain (same as Playwright flow)
    │
    └── Return LOGIN_SUCCESS to extension
```

**Timeout:** 5 minutes. If no callback received, return LOGIN_FAILED.

## Security Considerations

- **stdio trust model:** Native messaging uses stdin/stdout between browser and host process. Messages are not encrypted but run locally within the same user session. This is the standard Chrome native messaging security model.
- **Keychain access:** Token stored in macOS Keychain requires user approval on first access. Node process must be allowed in System Settings.
- **Extension origin validation:** Native host manifest specifies exact extension ID in `allowed_origins` - other extensions cannot communicate with this host.
- **No token in extension storage:** Tokens are fetched on-demand from native host, not persisted in `chrome.storage`. This reduces exposure if extension storage is compromised.

## Dependencies

### Native Host

```json
{
  "dependencies": {
    "keytar": "^7.9.0",
    "playwright": "^1.40.0"
  }
}
```

### Extension

No new dependencies - uses built-in `chrome.runtime.sendNativeMessage` API.
