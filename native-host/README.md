# Copilot Budget Overlay - Native Messaging Host

Native messaging host for the Copilot Budget Overlay Chrome extension. Reads auth tokens from macOS Keychain and handles automatic re-authentication.

## Features

- Reads Copilot tokens from macOS Keychain (same location as copilot-money-mcp)
- Automatic re-authentication via Playwright browser automation
- Email-link fallback when Playwright unavailable
- 1MB message size limit for security

## Prerequisites

- Node.js 20+
- macOS (uses Keychain via keytar)
- Chrome, Arc, or Chromium browser

## Installation

1. Install dependencies:
   ```bash
   cd native-host
   npm install
   ```

2. Install Playwright browsers (for automatic login):
   ```bash
   npx playwright install chromium
   ```

3. Register the native messaging host:
   ```bash
   # Find your extension ID in chrome://extensions (Developer mode)
   ./install.sh --extension-id=YOUR_EXTENSION_ID

   # For Chrome instead of Arc:
   ./install.sh --extension-id=YOUR_EXTENSION_ID chrome
   ```

4. Reload the extension in your browser.

## Configuration

For email-link fallback, set Firebase environment variables:
```bash
export COPILOT_FIREBASE_API_KEY="your-api-key"
export COPILOT_FIREBASE_PROJECT_ID="your-project-id"
```

These can be extracted from the Copilot Money web app (same as copilot-money-mcp).

## Message Protocol

The host uses Chrome's native messaging protocol (4-byte little-endian length prefix).

### GET_TOKEN
```json
{ "type": "GET_TOKEN" }
// Returns: { "type": "TOKEN", "token": "...", "expiresAt": 1234567890 }
// Or: { "type": "NO_TOKEN" }
// Or: { "type": "TOKEN_EXPIRED", "expiresAt": 1234567890 }
```

### LOGIN
```json
{ "type": "LOGIN", "email": "user@example.com" }
// Returns: { "type": "LOGIN_SUCCESS", "token": "...", "expiresAt": 1234567890 }
// Or: { "type": "LOGIN_NEEDS_EMAIL", "error": "...", "message": "..." }
// Or: { "type": "LOGIN_FAILED", "error": "..." }
```

### STATUS
```json
{ "type": "STATUS" }
// Returns: { "type": "STATUS_OK", "version": "1.0.0", "playwrightAvailable": true }
```

## Keychain Storage

Uses the same service as copilot-money-mcp:
- **Service:** `copilot-money-mcp`
- **Accounts:** `access_token`, `expires_at`

## Testing

```bash
npm test
```

## Troubleshooting

**"Native host not found"**
- Verify install.sh completed successfully
- Check extension ID matches your loaded extension
- Ensure browser has been restarted after installation

**"Keychain access denied"**
- Grant "node" access in System Settings → Privacy & Security → Keychain Access

**"Playwright not available"**
- Run `npx playwright install chromium`
- Or set Firebase env vars for email-link fallback
