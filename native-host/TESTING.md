# Testing Guide

## Running Tests

```bash
npm test
```

## Test Results (2026-03-25)

```
✔ constants (0.91ms)
✔ email-link login module (32.2ms)
✔ index (18.1ms)
✔ install.sh (8.3ms)
✔ keychain (1.1ms)
✔ playwright login module (195.9ms)

ℹ tests 59
ℹ suites 27
ℹ pass 59
ℹ fail 0
ℹ duration_ms 259ms
```

## Test Coverage by Module

| Module | Tests | Coverage |
|--------|-------|----------|
| constants.js | 2 | TOKEN_TTL value and type |
| keychain.js | 4 | isExpired edge cases |
| index.js | 12 | Protocol, handlers, integration |
| playwright.js | 13 | Exports, constants, capture, timeout, cleanup |
| email-link.js | 18 | Exports, env, GraphQL, HTTP server, timeout, errors |
| install.sh | 16 | Shell safety, validation, browsers, manifest |

## Manual Testing Checklist

### Installation
- [ ] `npm install` completes without errors
- [ ] `npx playwright install chromium` installs browser
- [ ] `./install.sh --extension-id=...` creates manifest
- [ ] Manifest appears in correct browser directory

### Extension Communication
- [ ] Extension detects native host (STATUS message)
- [ ] GET_TOKEN returns stored token
- [ ] LOGIN triggers Playwright browser
- [ ] Token captured and stored in Keychain

### Error Handling
- [ ] Invalid extension ID rejected by install.sh
- [ ] Missing Firebase config returns clear error
- [ ] Login timeout handled gracefully

## Integration Test

To manually test the native messaging protocol:

```bash
# Create a test message (STATUS request)
echo '{"type":"STATUS"}' | node -e "
const msg = require('fs').readFileSync(0, 'utf8');
const buf = Buffer.from(msg);
const header = Buffer.alloc(4);
header.writeUInt32LE(buf.length);
process.stdout.write(header);
process.stdout.write(buf);
" | node index.js | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const buf = Buffer.concat(chunks);
  const len = buf.readUInt32LE(0);
  console.log(JSON.parse(buf.slice(4, 4+len).toString()));
});
"
```

Expected output:
```json
{ "type": "STATUS_OK", "version": "1.0.0", "playwrightAvailable": true }
```
