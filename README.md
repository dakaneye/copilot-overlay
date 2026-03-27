# Copilot Budget Overlay

Chrome extension that displays your [Copilot.money](https://copilot.money) budget on checkout pages.

## Requirements

- Node.js 20+
- Chrome, Arc, or Chromium browser
- macOS (native host uses Keychain)

## Setup

### 1. Install the auth CLI

```bash
npm install -g @dakaneye-js/copilot-money-mcp
```

This provides the `copilot-auth` command for authentication.

### 2. Authenticate with Copilot

```bash
copilot-auth login
```

A browser window opens. Sign in to Copilot. The daemon starts automatically and keeps your token fresh.

### 3. Build the extension

```bash
git clone https://github.com/dakaneye/copilot-overlay.git
cd copilot-overlay
npm install && npm run build
```

### 4. Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `copilot-overlay` folder
5. Copy the **Extension ID** shown (32 characters)

### 5. Install native host

```bash
cd native-host
npm install
./install.sh --extension-id=YOUR_EXTENSION_ID arc
```

Replace `arc` with `chrome` or `chromium` if using those browsers.

### 6. Reload the extension

Click the reload button on the extension card in `chrome://extensions`.

## Usage

Visit any supported checkout page. The overlay appears showing your budget for that category.

Click the extension icon to see connection status.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Overlay not showing | Check `copilot-auth status` - daemon should be running |
| "Not authenticated" in popup | Run `copilot-auth login` |
| Native host not found | Re-run `install.sh` with correct extension ID |
| Token expired | Daemon auto-refreshes; if stuck, run `copilot-auth login` again |

### Check auth status

```bash
copilot-auth status
```

Should show:
```
Status: Authenticated
Email: your@email.com
Token: expires in X minutes
Daemon: Running
```

### View native host logs

```bash
tail -f /tmp/copilot-native-host.log
```

## Supported Sites

| Site | Category |
|------|----------|
| amazon.com | Shopping |
| target.com | Shopping |
| walmart.com | Shopping |
| bestbuy.com | Shopping |
| costco.com | Shopping |
| homedepot.com | Shopping |
| etsy.com | Shopping |
| apple.com | Shopping |
| ubereats.com | Food & Drink |
| doordash.com | Food & Drink |
| instacart.com | Food & Drink |

## Adding Sites

Edit `src/site-configs.json`:

```json
{
  "example.com": {
    "checkout": {
      "urlPatterns": ["/checkout", "/cart"],
      "domIndicators": ["[data-testid='checkout']"]
    },
    "subtotal": {
      "selectors": [".order-total"]
    },
    "category": "Shopping"
  }
}
```

Then rebuild: `npm run build`

## Architecture

```
User runs: copilot-auth login (one time)
              ↓
        copilot-auth daemon (auto-refreshes token)
              ↓
        Keychain: copilot-money-auth/token
              ↓
Extension → Native Host → Keychain → Token → Copilot API → Budget → Overlay
```

The extension cannot access the keychain directly (Chrome sandbox), so it uses native messaging to communicate with a small Node.js host that reads the token.

## Development

```bash
npm run build    # Build once
npm run watch    # Watch mode

cd native-host
npm test         # Run tests (42 tests)
```

## Project Structure

```
copilot-overlay/
├── manifest.json          # Chrome extension manifest (V3)
├── src/
│   ├── content.js         # Injected into checkout pages
│   ├── background.js      # Service worker (API calls)
│   ├── overlay.js         # Budget overlay DOM
│   ├── popup.js           # Extension popup
│   └── site-configs.json  # Site selectors
├── native-host/
│   ├── index.js           # Native messaging entry
│   ├── keychain.js        # Keychain token access
│   └── install.sh         # Host registration
└── build.js               # Bundles src/ for Chrome
```

## License

MIT
