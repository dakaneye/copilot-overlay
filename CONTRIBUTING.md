# Contributing

## Development

```bash
git clone https://github.com/dakaneye/copilot-overlay.git
cd copilot-overlay
npm install
npm run build
```

### Native Host Setup

```bash
cd native-host
npm install
./install.sh --extension-id YOUR_EXTENSION_ID
```

## Commands

```bash
npm run build      # Build extension
npm run watch      # Watch mode

# Native host tests
cd native-host
npm test
```

## Before Submitting

1. `npm run build` passes
2. `cd native-host && npm test` passes
3. New functionality has tests

## Pull Requests

- Keep changes focused
- Update tests for new functionality
- Follow existing code style

## Adding Site Support

To add support for a new shopping site:

1. Edit `src/site-configs.json`
2. Add entry with:
   - `checkout.urlPatterns`: URL paths that indicate checkout
   - `checkout.domIndicators`: CSS selectors that confirm checkout page
   - `subtotal.selectors`: CSS selectors to find the total/subtotal element
   - `category`: Copilot budget category (e.g., "Shopping", "Food & Drink")

Example:
```json
"example.com": {
  "checkout": {
    "urlPatterns": ["/checkout", "/cart"],
    "domIndicators": ["[data-testid='checkout']"]
  },
  "subtotal": {
    "selectors": [".order-total", "#cart-total"]
  },
  "category": "Shopping"
}
```
