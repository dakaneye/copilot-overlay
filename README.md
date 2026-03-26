# Copilot Budget Overlay

Chrome extension that displays [Copilot.money](https://copilot.money) budget on checkout pages.

## Quick Start

```bash
# 1. Build extension
npm install && npm run build

# 2. Load in Chrome
# - Open chrome://extensions
# - Enable "Developer mode" (top right)
# - Click "Load unpacked"
# - Select this repository folder
# - Copy the Extension ID shown (32 characters)

# 3. Install native host (enables secure login)
cd native-host
npm install
./install.sh --extension-id <EXTENSION_ID>
```

## Requirements

- Node.js 20+
- Chrome/Arc/Chromium browser
- macOS (native host uses Keychain)

## Project Structure

```
copilot-overlay/
├── manifest.json          # Chrome extension manifest (V3)
├── src/
│   ├── content.js         # Injected into checkout pages
│   ├── background.js      # Service worker (auth, API calls)
│   ├── overlay.js         # Budget overlay DOM creation
│   ├── popup.js           # Extension popup UI
│   ├── settings.js        # Settings page logic
│   ├── site-configs.json  # Site selectors and categories
│   └── api/
│       └── copilot.js     # Copilot GraphQL API client
├── styles/
│   └── overlay.css        # Overlay styling
├── native-host/
│   ├── index.js           # Native messaging host entry
│   ├── keychain.js        # macOS Keychain token storage
│   ├── install.sh         # Host registration script
│   └── login/
│       └── playwright.js  # Browser-based login flow
└── build.js               # Bundles src/ for Chrome
```

## Configuration

Click extension icon → Settings:

| Setting | Description |
|---------|-------------|
| Auth Mode | `native` (recommended) or `api_key` |
| Category | Default Copilot budget category |
| Enabled | Toggle overlay on/off |

## Site Configs

Edit `src/site-configs.json` to add sites:

```json
{
  "example.com": {
    "checkout": {
      "urlPatterns": ["/checkout", "/cart"],
      "domIndicators": ["[data-testid='checkout-container']"]
    },
    "subtotal": {
      "selectors": [".order-total", "#cart-subtotal"]
    },
    "category": "Shopping"
  }
}
```

| Field | Purpose |
|-------|---------|
| `urlPatterns` | URL paths that indicate checkout page |
| `domIndicators` | CSS selectors that must exist on page |
| `selectors` | CSS selectors to find total/subtotal element |
| `category` | Copilot budget category name |

## Native Host

Stores tokens in macOS Keychain. Communicates via Chrome Native Messaging.

```bash
# Install for specific browser
./install.sh --extension-id <ID> --browser chrome  # or arc, chromium

# Test manually
echo '{"type":"STATUS"}' | node index.js

# View logs
tail -f /tmp/copilot-native-host.log
```

### Message Types

| Type | Purpose |
|------|---------|
| `STATUS` | Returns `{type: "STATUS_OK", version}` |
| `GET_TOKEN` | Returns cached token or `{needsLogin: true}` |
| `LOGIN` | Opens browser for OAuth, captures token |

## API

`src/api/copilot.js` uses Copilot's GraphQL API:

```javascript
import { fetchCategoriesWithBudgets } from './api/copilot.js';

const categories = await fetchCategoriesWithBudgets(token);
// Returns: [{ name, icon, budgetAmount, spentAmount, rolloverAmount }]
```

## Development

```bash
npm run build    # Build once
npm run watch    # Watch mode

cd native-host
npm test         # Run tests (66 tests)
```

## Supported Sites

| Site | Category | Selector |
|------|----------|----------|
| amazon.com | Shopping | `#subtotals-marketplace-table .a-text-bold` |
| target.com | Shopping | `[data-test='cart-summary-total']` |
| walmart.com | Shopping | `[data-testid='total-price']` |
| bestbuy.com | Shopping | `.order-summary__total` |
| costco.com | Shopping | `#order-summary .value` |
| homedepot.com | Shopping | `.cart-total__value` |
| etsy.com | Shopping | `[data-selector='total-value']` |
| apple.com | Shopping | `[data-autom='bagtotalvalue']` |
| ubereats.com | Food & Drink | `[data-testid='cart-total']` |
| doordash.com | Food & Drink | `[data-anchor-id='OrderCartTotal']` |
| instacart.com | Food & Drink | `[data-testid='order-total']` |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "not_configured" error | Open extension settings, verify auth mode |
| Login window closes immediately | Token captured from cached session; clear Copilot cookies |
| Overlay not showing | Check console for selector errors; site may need new config |
| Native host not found | Re-run `install.sh` with correct extension ID |

## License

MIT
