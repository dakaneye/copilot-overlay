# Copilot Budget Overlay

A Chrome extension that displays your [Copilot.money](https://copilot.money) budget information on checkout pages, helping you stay within budget while shopping online.

## Features

- Shows remaining budget on checkout pages
- Supports multiple retailers: Amazon, Target, Walmart, Best Buy, Costco, Home Depot, Etsy, Apple
- Supports food delivery: Uber Eats, DoorDash, Instacart
- Visual indicators for budget status (normal, warning, over budget)
- Automatic category detection based on the site
- Native messaging host for secure token storage in system keychain

## Installation

### Chrome Extension

1. Clone this repository
2. Run `npm install && npm run build`
3. Open Chrome and go to `chrome://extensions`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the repository folder

### Native Host (for secure login)

The native messaging host stores your Copilot token securely in the system keychain.

```bash
cd native-host
npm install
./install.sh --extension-id YOUR_EXTENSION_ID
```

Get your extension ID from `chrome://extensions` after loading the unpacked extension.

## Configuration

1. Click the extension icon in Chrome
2. Click "Settings" to configure:
   - **Auth Mode**: Choose between API key or native messaging
   - **Category Mapping**: Map sites to your Copilot budget categories
   - **Enable/Disable**: Toggle the overlay on/off

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Watch for changes
npm run watch

# Run native host tests
cd native-host && npm test
```

## Supported Sites

| Site | Category |
|------|----------|
| Amazon | Shopping |
| Target | Shopping |
| Walmart | Shopping |
| Best Buy | Shopping |
| Costco | Shopping |
| Home Depot | Shopping |
| Etsy | Shopping |
| Apple | Shopping |
| Uber Eats | Food & Drink |
| DoorDash | Food & Drink |
| Instacart | Food & Drink |

## Privacy

- Your Copilot credentials are stored securely in your system keychain (via the native host)
- The extension only activates on checkout pages of supported sites
- No data is sent to third parties

## License

MIT
