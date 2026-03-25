# Copilot Budget Overlay — Design Spec

Chrome extension that displays Copilot.money budget information on checkout pages.

## Problem

When shopping online, it's easy to lose track of budget limits. Users must manually check Copilot.money before purchases to see remaining budget. This friction means most purchases happen without budget awareness.

## Solution

A Chrome extension that detects checkout pages and injects a budget overlay inline below the subtotal. The overlay shows the relevant budget category, amount spent, and remaining balance — providing awareness at the moment of purchase decision.

## Requirements

### Functional

1. Detect checkout pages on supported retail sites
2. Find and parse the subtotal/total element on the page
3. Determine budget category for the current site
4. Fetch budget data from Copilot GraphQL API
5. Inject overlay below the subtotal showing budget status
6. Update overlay when cart total changes (MutationObserver)
7. Indicate visual state based on budget health (green/orange/red)

### Non-Functional

1. Overlay injection must not break page layout
2. Budget data cached to minimize API calls
3. Extension must work without Claude API (falls back to "Other" category)
4. No user data sent to external services except Copilot API and Claude API

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    messages    ┌──────────────────────────┐   │
│  │   Content    │◄──────────────►│   Background Service     │   │
│  │   Script     │                │   Worker                 │   │
│  │              │                │                          │   │
│  │ • Detect     │                │ • Budget cache           │   │
│  │   checkout   │                │ • API calls (Copilot)    │   │
│  │ • Find       │                │ • AI categorization      │   │
│  │   subtotal   │                │ • Domain → category map  │   │
│  │ • Inject     │                │                          │   │
│  │   overlay    │                └───────────┬──────────────┘   │
│  └──────────────┘                            │                  │
│         │                                    │                  │
│         ▼                                    ▼                  │
│  ┌──────────────┐                ┌──────────────────────────┐   │
│  │ site-configs │                │   chrome.storage.local   │   │
│  │    .json     │                │   • budgets              │   │
│  └──────────────┘                │   • domain mappings      │   │
│                                  │   • user overrides       │   │
│                                  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Components

**Content Script** — Runs on all pages. Checks domain against site configs, detects checkout pages, finds subtotal elements, requests budget data from background worker, injects and updates overlay.

**Background Service Worker** — Maintains budget cache, handles Copilot API authentication and requests, manages domain-to-category mappings, calls Claude Haiku for unknown site categorization.

**Site Configs** — JSON file defining checkout detection patterns and subtotal selectors for known retailers.

**Storage** — Persists budget cache, domain mappings, user overrides, and API tokens.

## Site Config Format

```json
{
  "amazon.com": {
    "category": "Shopping",
    "checkout": {
      "urlPatterns": ["/gp/buy/", "/checkout/"],
      "domIndicators": ["#subtotals-marketplace-table", ".order-summary"]
    },
    "subtotal": {
      "selectors": [
        ".grand-total-price",
        "#subtotals-marketplace-table .a-color-price"
      ],
      "priceRegex": "\\$[\\d,]+\\.\\d{2}"
    }
  }
}
```

**Detection logic:**
1. Match current domain against config keys
2. Check if URL matches any `urlPatterns`
3. Confirm checkout by finding any `domIndicators` in DOM
4. Extract price from first matching `subtotal.selectors`

For unknown sites: generic heuristics search for elements containing "total", "subtotal", "$" near checkout buttons.

**Initial supported sites (10):**
- Amazon
- Target
- Walmart
- Best Buy
- Uber Eats
- DoorDash
- Instacart
- Costco
- Home Depot
- Etsy

## Content Script Flow

```
Page Load
    │
    ▼
Check domain against site-configs.json
    │
    ├─► Known site: use config selectors
    │
    └─► Unknown site: generic heuristics
    │
    ▼
Is this a checkout page?
(URL pattern match + DOM indicators present)
    │
    ▼ Yes
Find subtotal element, extract price
    │
    ▼ Found
Request budget from background worker
(send: domain, suggested category from config)
    │
    ▼
Inject overlay below subtotal element
    │
    ▼
Watch for DOM changes (MutationObserver)
Update overlay if total changes
```

## Background Worker Flow

```
Message: GET_BUDGET { domain, suggestedCategory }
    │
    ▼
Resolve category for domain:
    1. Check user overrides
    2. Check site config
    3. Check cached mappings
    4. Call Haiku for suggestion (cache result)
    │
    ▼
Fetch budget from Copilot GraphQL API
(use cached data if fresh, <15 min old)
    │
    ▼
Return: { category, budget, spent, remaining }
```

## AI Categorization

For unknown domains, call Claude Haiku with a constrained prompt:

```
System: You categorize websites into budget categories. Respond with
only the category name, nothing else.

Categories: [fetched from Copilot at startup]

User: What budget category is "chewy.com"?
```

**When called:**
- Domain not in site-configs
- Domain not in user overrides
- Domain not in cached mappings

**Cost:** ~$0.25/million input tokens. A categorization is ~50 tokens. Negligible cost.

Results are cached permanently per domain.

## Overlay Design

### Layout

Injected inline below the detected subtotal element:

```
┌────────────────────────────────────────┐
│ SHOPPING BUDGET          $96 of $300  │
│ $204 remaining              this month │
└────────────────────────────────────────┘
```

### Visual States

| State | Condition | Color |
|-------|-----------|-------|
| Normal | remaining > 30% of budget | Green (#4caf50) |
| Warning | remaining < 30% of budget | Orange (#ff9800) |
| Over | spent > budget | Red (#f44336) |

### Styling

- Subtle gradient background matching state color
- Left border accent (4px) in state color
- System font stack for consistency
- 12px padding, 8px border radius
- Does not interfere with page checkout button

## Extension Popup

Minimal popup showing:
- Connection status (connected to Copilot or error)
- Link to settings page

Does NOT show budget dashboard — overlay handles that contextually.

## Settings Page

- Copilot API token input
- Claude API key input (optional, for Haiku)
- Domain overrides table (add/edit/remove domain → category mappings)
- Enable/disable extension toggle
- Manual cache refresh button

## First-Run Flow

1. User installs extension
2. Opens popup, sees "Not connected"
3. Clicks settings, enters Copilot API token
4. Extension fetches categories and budgets
5. Status shows "Connected"
6. Extension active on supported sites

## Caching Strategy

| Data | TTL | Storage |
|------|-----|---------|
| Budget amounts | 15 minutes | chrome.storage.local |
| Category list | 1 hour | chrome.storage.local |
| Domain mappings | Permanent | chrome.storage.local |
| User overrides | Permanent | chrome.storage.local |

## Error Handling

| Error | Behavior |
|-------|----------|
| Copilot API unreachable | Use cached data if available; show "offline" indicator |
| Subtotal not found | Don't inject overlay (silent) |
| Haiku categorization fails | Fall back to "Other" category |
| Unknown category from Haiku | Map to closest match or "Other" |
| No budget set for category | Show "No budget set" in neutral gray |

## File Structure

```
copilot-overlay/
├── manifest.json
├── src/
│   ├── background.js      # Service worker
│   ├── content.js         # Page injection
│   ├── popup.html         # Extension popup
│   ├── popup.js
│   ├── settings.html      # Settings page
│   ├── settings.js
│   ├── site-configs.json  # Retailer patterns
│   └── api/
│       ├── copilot.js     # Copilot GraphQL client
│       └── claude.js      # Haiku categorization
├── styles/
│   ├── overlay.css
│   ├── popup.css
│   └── settings.css
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## Security Considerations

- API tokens stored in chrome.storage.local (encrypted by Chrome)
- No tokens exposed to content scripts
- Content script communicates with background via chrome.runtime messages only
- No external scripts loaded into pages
- Overlay injected as isolated DOM, scoped CSS

## Out of Scope

- Budget editing from extension
- Transaction history
- Multiple Copilot accounts
- Firefox/Safari support (Chrome only for v1)
- Mobile browsers
