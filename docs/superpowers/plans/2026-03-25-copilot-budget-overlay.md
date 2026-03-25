# Copilot Budget Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that displays Copilot.money budget information on checkout pages.

**Architecture:** Content script detects checkout pages using site configs, requests budget data from background service worker, and injects an overlay below the subtotal. Background worker manages Copilot API, caching, and AI categorization via Haiku.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JavaScript, Chrome Storage API, Copilot GraphQL API, Claude Haiku API

---

## File Structure

```
copilot-overlay/
├── manifest.json              # Extension manifest (permissions, scripts, icons)
├── src/
│   ├── background.js          # Service worker: API calls, caching, categorization
│   ├── content.js             # Page injection: detect checkout, inject overlay
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Popup logic: status display, settings link
│   ├── settings.html          # Settings page UI
│   ├── settings.js            # Settings logic: token input, overrides table
│   ├── site-configs.json      # Checkout detection patterns for 10 retailers
│   ├── overlay.js             # Overlay component: create, update, style
│   └── api/
│       ├── copilot.js         # Copilot GraphQL client
│       └── claude.js          # Haiku categorization client
├── styles/
│   ├── overlay.css            # Overlay styling (injected into pages)
│   ├── popup.css              # Popup styling
│   └── settings.css           # Settings page styling
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `manifest.json`
- Create: `icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png`

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Copilot Budget Overlay",
  "version": "1.0.0",
  "description": "Display Copilot.money budget information on checkout pages",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://*.amazon.com/*",
    "https://*.target.com/*",
    "https://*.walmart.com/*",
    "https://*.bestbuy.com/*",
    "https://*.ubereats.com/*",
    "https://*.doordash.com/*",
    "https://*.instacart.com/*",
    "https://*.costco.com/*",
    "https://*.homedepot.com/*",
    "https://*.etsy.com/*"
  ],
  "background": {
    "service_worker": "src/background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "https://*.amazon.com/*",
        "https://*.target.com/*",
        "https://*.walmart.com/*",
        "https://*.bestbuy.com/*",
        "https://*.ubereats.com/*",
        "https://*.doordash.com/*",
        "https://*.instacart.com/*",
        "https://*.costco.com/*",
        "https://*.homedepot.com/*",
        "https://*.etsy.com/*"
      ],
      "js": ["src/content.js"],
      "css": ["styles/overlay.css"]
    }
  ],
  "action": {
    "default_popup": "src/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

- [ ] **Step 2: Create placeholder icons**

Create simple placeholder icons using a basic green circle with "$" symbol. These can be replaced with proper icons later.

Run:
```bash
mkdir -p icons
# Create simple placeholder PNGs (green squares for now)
convert -size 16x16 xc:#4caf50 icons/icon-16.png 2>/dev/null || echo "Install imagemagick or create icons manually"
convert -size 48x48 xc:#4caf50 icons/icon-48.png 2>/dev/null || echo "Install imagemagick or create icons manually"
convert -size 128x128 xc:#4caf50 icons/icon-128.png 2>/dev/null || echo "Install imagemagick or create icons manually"
```

If imagemagick not available, create icons manually or use any 16x16, 48x48, 128x128 PNG files.

- [ ] **Step 3: Commit scaffolding**

```bash
git add manifest.json icons/
git commit -m "chore: add extension manifest and placeholder icons"
```

---

## Task 2: Site Configs

**Files:**
- Create: `src/site-configs.json`

- [ ] **Step 1: Create site-configs.json with 10 retailers**

```json
{
  "amazon.com": {
    "category": "Shopping",
    "checkout": {
      "urlPatterns": ["/gp/buy/", "/checkout/", "/cart/"],
      "domIndicators": ["#subtotals-marketplace-table", ".order-summary", "#sc-buy-box"]
    },
    "subtotal": {
      "selectors": [
        ".grand-total-price",
        "#sc-subtotal-amount-activecart",
        "[data-name='Active Items Subtotal']"
      ],
      "priceRegex": "\\$[\\d,]+\\.\\d{2}"
    }
  },
  "target.com": {
    "category": "Shopping",
    "checkout": {
      "urlPatterns": ["/cart", "/checkout"],
      "domIndicators": ["[data-test='cart-summary']", "[data-test='orderSummary']"]
    },
    "subtotal": {
      "selectors": [
        "[data-test='cart-summary-total']",
        "[data-test='total']"
      ],
      "priceRegex": "\\$[\\d,]+\\.\\d{2}"
    }
  },
  "walmart.com": {
    "category": "Shopping",
    "checkout": {
      "urlPatterns": ["/cart", "/checkout"],
      "domIndicators": ["[data-testid='cart-summary']", ".cart-summary"]
    },
    "subtotal": {
      "selectors": [
        "[data-testid='subtotal-value']",
        ".price-characteristic"
      ],
      "priceRegex": "\\$[\\d,]+\\.\\d{2}"
    }
  },
  "bestbuy.com": {
    "category": "Shopping",
    "checkout": {
      "urlPatterns": ["/cart", "/checkout"],
      "domIndicators": [".order-summary", ".cart-summary"]
    },
    "subtotal": {
      "selectors": [
        ".order-summary__total .cash-money",
        ".price-summary__total-value"
      ],
      "priceRegex": "\\$[\\d,]+\\.\\d{2}"
    }
  },
  "ubereats.com": {
    "category": "Food & Drink",
    "checkout": {
      "urlPatterns": ["/checkout", "/cart"],
      "domIndicators": ["[data-testid='cart-container']", "[data-testid='checkout']"]
    },
    "subtotal": {
      "selectors": [
        "[data-testid='total-amount']",
        "[data-testid='cart-total']"
      ],
      "priceRegex": "\\$[\\d,]+\\.\\d{2}"
    }
  },
  "doordash.com": {
    "category": "Food & Drink",
    "checkout": {
      "urlPatterns": ["/checkout", "/cart"],
      "domIndicators": ["[data-anchor-id='CartContainer']", ".OrderCart"]
    },
    "subtotal": {
      "selectors": [
        "[data-anchor-id='CartTotal']",
        ".OrderCart-total"
      ],
      "priceRegex": "\\$[\\d,]+\\.\\d{2}"
    }
  },
  "instacart.com": {
    "category": "Food & Drink",
    "checkout": {
      "urlPatterns": ["/checkout", "/store/checkout"],
      "domIndicators": ["[data-testid='checkout-container']", ".checkout-summary"]
    },
    "subtotal": {
      "selectors": [
        "[data-testid='order-total']",
        ".checkout-total"
      ],
      "priceRegex": "\\$[\\d,]+\\.\\d{2}"
    }
  },
  "costco.com": {
    "category": "Shopping",
    "checkout": {
      "urlPatterns": ["/cart", "/checkout"],
      "domIndicators": [".order-summary", "#cart-summary"]
    },
    "subtotal": {
      "selectors": [
        ".order-summary-total .value",
        "#order-estimated-total"
      ],
      "priceRegex": "\\$[\\d,]+\\.\\d{2}"
    }
  },
  "homedepot.com": {
    "category": "Shopping",
    "checkout": {
      "urlPatterns": ["/cart", "/checkout"],
      "domIndicators": [".cart-summary", ".order-summary"]
    },
    "subtotal": {
      "selectors": [
        ".cart-summary__total-value",
        ".order-summary__total"
      ],
      "priceRegex": "\\$[\\d,]+\\.\\d{2}"
    }
  },
  "etsy.com": {
    "category": "Shopping",
    "checkout": {
      "urlPatterns": ["/cart", "/checkout"],
      "domIndicators": ["[data-cart-summary]", ".cart-summary"]
    },
    "subtotal": {
      "selectors": [
        "[data-estimated-total]",
        ".cart-total-value"
      ],
      "priceRegex": "\\$[\\d,]+\\.\\d{2}"
    }
  }
}
```

- [ ] **Step 2: Commit site configs**

```bash
git add src/site-configs.json
git commit -m "feat: add site configs for 10 retailers"
```

---

## Task 3: Overlay Styling

**Files:**
- Create: `styles/overlay.css`

- [ ] **Step 1: Create overlay.css**

```css
.copilot-budget-overlay {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  box-sizing: border-box;
}

.copilot-budget-overlay--normal {
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%);
  border-left: 4px solid #4caf50;
}

.copilot-budget-overlay--warning {
  background: linear-gradient(135deg, #fff3e0 0%, #fff8e1 100%);
  border-left: 4px solid #ff9800;
}

.copilot-budget-overlay--over {
  background: linear-gradient(135deg, #ffebee 0%, #fce4ec 100%);
  border-left: 4px solid #f44336;
}

.copilot-budget-overlay--offline {
  background: linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%);
  border-left: 4px solid #9e9e9e;
}

.copilot-budget-overlay--no-budget {
  background: linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%);
  border-left: 4px solid #9e9e9e;
}

.copilot-budget-overlay__content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.copilot-budget-overlay__left {
  display: flex;
  flex-direction: column;
}

.copilot-budget-overlay__category {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.copilot-budget-overlay__remaining {
  font-size: 18px;
  font-weight: 600;
}

.copilot-budget-overlay--normal .copilot-budget-overlay__remaining {
  color: #2e7d32;
}

.copilot-budget-overlay--warning .copilot-budget-overlay__remaining {
  color: #e65100;
}

.copilot-budget-overlay--over .copilot-budget-overlay__remaining {
  color: #c62828;
}

.copilot-budget-overlay--offline .copilot-budget-overlay__remaining,
.copilot-budget-overlay--no-budget .copilot-budget-overlay__remaining {
  color: #616161;
}

.copilot-budget-overlay__right {
  text-align: right;
  color: #666;
  font-size: 13px;
}

.copilot-budget-overlay__spent {
  margin-bottom: 2px;
}

.copilot-budget-overlay__period {
  font-size: 11px;
}
```

- [ ] **Step 2: Commit overlay styles**

```bash
git add styles/overlay.css
git commit -m "feat: add overlay CSS with visual states"
```

---

## Task 4: Overlay Component

**Files:**
- Create: `src/overlay.js`

- [ ] **Step 1: Create overlay.js**

```javascript
// src/overlay.js
// Creates and updates the budget overlay DOM element

const OVERLAY_ID = 'copilot-budget-overlay';

/**
 * Determine visual state based on budget status
 * @param {number} spent
 * @param {number} budget
 * @returns {'normal' | 'warning' | 'over'}
 */
function getVisualState(spent, budget) {
  if (spent > budget) return 'over';
  const remaining = budget - spent;
  const percentRemaining = remaining / budget;
  if (percentRemaining < 0.3) return 'warning';
  return 'normal';
}

/**
 * Format currency amount
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Create the overlay element
 * @param {object} data - Budget data
 * @param {string} data.category
 * @param {number} data.budget
 * @param {number} data.spent
 * @param {number} data.remaining
 * @param {boolean} [data.offline]
 * @param {boolean} [data.noBudget]
 * @returns {HTMLElement}
 */
export function createOverlay(data) {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'copilot-budget-overlay';

  if (data.offline) {
    overlay.classList.add('copilot-budget-overlay--offline');
    overlay.innerHTML = `
      <div class="copilot-budget-overlay__content">
        <div class="copilot-budget-overlay__left">
          <div class="copilot-budget-overlay__category">${data.category} Budget</div>
          <div class="copilot-budget-overlay__remaining">Offline</div>
        </div>
        <div class="copilot-budget-overlay__right">
          <div class="copilot-budget-overlay__spent">Using cached data</div>
        </div>
      </div>
    `;
    return overlay;
  }

  if (data.noBudget) {
    overlay.classList.add('copilot-budget-overlay--no-budget');
    overlay.innerHTML = `
      <div class="copilot-budget-overlay__content">
        <div class="copilot-budget-overlay__left">
          <div class="copilot-budget-overlay__category">${data.category}</div>
          <div class="copilot-budget-overlay__remaining">No budget set</div>
        </div>
      </div>
    `;
    return overlay;
  }

  const state = getVisualState(data.spent, data.budget);
  overlay.classList.add(`copilot-budget-overlay--${state}`);

  const remainingText = data.remaining >= 0
    ? `${formatCurrency(data.remaining)} remaining`
    : `${formatCurrency(Math.abs(data.remaining))} over`;

  overlay.innerHTML = `
    <div class="copilot-budget-overlay__content">
      <div class="copilot-budget-overlay__left">
        <div class="copilot-budget-overlay__category">${data.category} Budget</div>
        <div class="copilot-budget-overlay__remaining">${remainingText}</div>
      </div>
      <div class="copilot-budget-overlay__right">
        <div class="copilot-budget-overlay__spent">${formatCurrency(data.spent)} of ${formatCurrency(data.budget)}</div>
        <div class="copilot-budget-overlay__period">this month</div>
      </div>
    </div>
  `;

  return overlay;
}

/**
 * Update existing overlay with new data
 * @param {object} data - Budget data
 */
export function updateOverlay(data) {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    const newOverlay = createOverlay(data);
    existing.replaceWith(newOverlay);
  }
}

/**
 * Remove overlay from page
 */
export function removeOverlay() {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    existing.remove();
  }
}

/**
 * Inject overlay below target element
 * @param {HTMLElement} targetElement
 * @param {object} data - Budget data
 */
export function injectOverlay(targetElement, data) {
  removeOverlay();
  const overlay = createOverlay(data);
  targetElement.insertAdjacentElement('afterend', overlay);
}
```

- [ ] **Step 2: Commit overlay component**

```bash
git add src/overlay.js
git commit -m "feat: add overlay component with create/update/inject"
```

---

## Task 5: Copilot API Client

**Files:**
- Create: `src/api/copilot.js`

- [ ] **Step 1: Create copilot.js**

```javascript
// src/api/copilot.js
// Copilot GraphQL API client

const COPILOT_API_URL = 'https://api.copilot.money/graphql';

/**
 * Fetch budget categories from Copilot
 * @param {string} token - API token
 * @returns {Promise<string[]>} - List of category names
 */
export async function fetchCategories(token) {
  const query = `
    query GetCategories {
      categories {
        name
      }
    }
  `;

  const response = await fetch(COPILOT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Copilot API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Copilot GraphQL error: ${data.errors[0].message}`);
  }

  return data.data.categories.map(c => c.name);
}

/**
 * Fetch budget data for a category
 * @param {string} token - API token
 * @param {string} category - Category name
 * @returns {Promise<{category: string, budget: number, spent: number, remaining: number} | null>}
 */
export async function fetchBudget(token, category) {
  const query = `
    query GetBudget($category: String!) {
      budget(category: $category) {
        category
        budgetAmount
        spentAmount
      }
    }
  `;

  const response = await fetch(COPILOT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables: { category },
    }),
  });

  if (!response.ok) {
    throw new Error(`Copilot API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Copilot GraphQL error: ${data.errors[0].message}`);
  }

  const budget = data.data.budget;
  if (!budget) {
    return null;
  }

  return {
    category: budget.category,
    budget: budget.budgetAmount,
    spent: budget.spentAmount,
    remaining: budget.budgetAmount - budget.spentAmount,
  };
}

/**
 * Fetch all budgets
 * @param {string} token - API token
 * @returns {Promise<Map<string, {budget: number, spent: number, remaining: number}>>}
 */
export async function fetchAllBudgets(token) {
  const query = `
    query GetAllBudgets {
      budgets {
        category
        budgetAmount
        spentAmount
      }
    }
  `;

  const response = await fetch(COPILOT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Copilot API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Copilot GraphQL error: ${data.errors[0].message}`);
  }

  const budgets = new Map();
  for (const b of data.data.budgets) {
    budgets.set(b.category, {
      budget: b.budgetAmount,
      spent: b.spentAmount,
      remaining: b.budgetAmount - b.spentAmount,
    });
  }

  return budgets;
}
```

- [ ] **Step 2: Commit Copilot API client**

```bash
git add src/api/copilot.js
git commit -m "feat: add Copilot GraphQL API client"
```

---

## Task 6: Claude API Client

**Files:**
- Create: `src/api/claude.js`

- [ ] **Step 1: Create claude.js**

```javascript
// src/api/claude.js
// Claude Haiku categorization client

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Categorize a domain using Claude Haiku
 * @param {string} apiKey - Claude API key
 * @param {string} domain - Domain to categorize
 * @param {string[]} categories - Available category names
 * @returns {Promise<string>} - Suggested category
 */
export async function categorizeWithHaiku(apiKey, domain, categories) {
  const systemPrompt = `You categorize websites into budget categories. Respond with only the category name, nothing else.

Categories: ${categories.join(', ')}`;

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 50,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `What budget category is "${domain}"?`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const suggestion = data.content[0].text.trim();

  // Validate suggestion is a known category
  if (categories.includes(suggestion)) {
    return suggestion;
  }

  // Try case-insensitive match
  const match = categories.find(
    c => c.toLowerCase() === suggestion.toLowerCase()
  );
  if (match) {
    return match;
  }

  // Fall back to "Other" or first category
  return categories.includes('Other') ? 'Other' : categories[0];
}
```

- [ ] **Step 2: Commit Claude API client**

```bash
git add src/api/claude.js
git commit -m "feat: add Claude Haiku categorization client"
```

---

## Task 7: Background Service Worker

**Files:**
- Create: `src/background.js`

- [ ] **Step 1: Create background.js**

```javascript
// src/background.js
// Background service worker: API calls, caching, categorization

import { fetchCategories, fetchAllBudgets } from './api/copilot.js';
import { categorizeWithHaiku } from './api/claude.js';
import siteConfigs from './site-configs.json' with { type: 'json' };

const CACHE_TTL_BUDGETS = 15 * 60 * 1000; // 15 minutes
const CACHE_TTL_CATEGORIES = 60 * 60 * 1000; // 1 hour

// In-memory cache
let budgetCache = {
  data: null,
  timestamp: 0,
};

let categoryCache = {
  data: null,
  timestamp: 0,
};

/**
 * Get stored tokens
 */
async function getTokens() {
  const result = await chrome.storage.local.get(['copilotToken', 'claudeKey']);
  return {
    copilotToken: result.copilotToken || null,
    claudeKey: result.claudeKey || null,
  };
}

/**
 * Get domain mappings (user overrides + cached AI mappings)
 */
async function getDomainMappings() {
  const result = await chrome.storage.local.get(['domainMappings']);
  return result.domainMappings || {};
}

/**
 * Save domain mapping
 */
async function saveDomainMapping(domain, category) {
  const mappings = await getDomainMappings();
  mappings[domain] = category;
  await chrome.storage.local.set({ domainMappings: mappings });
}

/**
 * Get category for domain
 */
async function getCategoryForDomain(domain, suggestedCategory) {
  // 1. Check user overrides / cached mappings
  const mappings = await getDomainMappings();
  if (mappings[domain]) {
    return mappings[domain];
  }

  // 2. Check site config
  const baseDomain = domain.replace(/^www\./, '');
  const config = Object.entries(siteConfigs).find(([key]) =>
    baseDomain.includes(key)
  );
  if (config && config[1].category) {
    return config[1].category;
  }

  // 3. Use suggested category from content script if provided
  if (suggestedCategory) {
    return suggestedCategory;
  }

  // 4. Try AI categorization
  const { claudeKey } = await getTokens();
  if (claudeKey && categoryCache.data) {
    try {
      const category = await categorizeWithHaiku(
        claudeKey,
        baseDomain,
        categoryCache.data
      );
      await saveDomainMapping(domain, category);
      return category;
    } catch (error) {
      console.error('Haiku categorization failed:', error);
    }
  }

  // 5. Fall back to "Other"
  return 'Other';
}

/**
 * Fetch and cache categories
 */
async function refreshCategories() {
  const { copilotToken } = await getTokens();
  if (!copilotToken) return null;

  const now = Date.now();
  if (categoryCache.data && now - categoryCache.timestamp < CACHE_TTL_CATEGORIES) {
    return categoryCache.data;
  }

  try {
    const categories = await fetchCategories(copilotToken);
    categoryCache = { data: categories, timestamp: now };
    return categories;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return categoryCache.data; // Return stale if available
  }
}

/**
 * Fetch and cache budgets
 */
async function refreshBudgets() {
  const { copilotToken } = await getTokens();
  if (!copilotToken) return null;

  const now = Date.now();
  if (budgetCache.data && now - budgetCache.timestamp < CACHE_TTL_BUDGETS) {
    return budgetCache.data;
  }

  try {
    const budgets = await fetchAllBudgets(copilotToken);
    budgetCache = { data: budgets, timestamp: now };
    return budgets;
  } catch (error) {
    console.error('Failed to fetch budgets:', error);
    return budgetCache.data; // Return stale if available
  }
}

/**
 * Handle GET_BUDGET message
 */
async function handleGetBudget(domain, suggestedCategory) {
  const { copilotToken } = await getTokens();

  if (!copilotToken) {
    return { error: 'not_configured' };
  }

  // Refresh categories first (needed for AI categorization)
  await refreshCategories();

  // Get category for this domain
  const category = await getCategoryForDomain(domain, suggestedCategory);

  // Refresh budgets
  const budgets = await refreshBudgets();

  if (!budgets) {
    return { error: 'offline', category };
  }

  const budgetData = budgets.get(category);

  if (!budgetData) {
    return {
      category,
      noBudget: true,
    };
  }

  return {
    category,
    budget: budgetData.budget,
    spent: budgetData.spent,
    remaining: budgetData.remaining,
  };
}

/**
 * Handle GET_STATUS message
 */
async function handleGetStatus() {
  const { copilotToken } = await getTokens();

  if (!copilotToken) {
    return { connected: false, reason: 'no_token' };
  }

  try {
    await refreshCategories();
    return { connected: true };
  } catch {
    return { connected: false, reason: 'api_error' };
  }
}

/**
 * Handle REFRESH_CACHE message
 */
async function handleRefreshCache() {
  budgetCache = { data: null, timestamp: 0 };
  categoryCache = { data: null, timestamp: 0 };
  await refreshCategories();
  await refreshBudgets();
  return { success: true };
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, domain, suggestedCategory } = message;

  if (type === 'GET_BUDGET') {
    handleGetBudget(domain, suggestedCategory).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (type === 'GET_STATUS') {
    handleGetStatus().then(sendResponse);
    return true;
  }

  if (type === 'REFRESH_CACHE') {
    handleRefreshCache().then(sendResponse);
    return true;
  }

  return false;
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Copilot Budget Overlay installed');
});
```

- [ ] **Step 2: Commit background service worker**

```bash
git add src/background.js
git commit -m "feat: add background service worker with caching and messaging"
```

---

## Task 8: Content Script

**Files:**
- Create: `src/content.js`

- [ ] **Step 1: Create content.js**

```javascript
// src/content.js
// Content script: detect checkout, find subtotal, inject overlay

import { injectOverlay, updateOverlay, removeOverlay } from './overlay.js';
import siteConfigs from './site-configs.json' with { type: 'json' };

const PRICE_REGEX = /\$[\d,]+\.\d{2}/;

/**
 * Get site config for current domain
 */
function getSiteConfig() {
  const hostname = window.location.hostname.replace(/^www\./, '');

  for (const [domain, config] of Object.entries(siteConfigs)) {
    if (hostname.includes(domain)) {
      return { domain, config };
    }
  }

  return null;
}

/**
 * Check if current page is a checkout page
 */
function isCheckoutPage(config) {
  const url = window.location.pathname;

  // Check URL patterns
  const urlMatch = config.checkout.urlPatterns.some(pattern =>
    url.includes(pattern)
  );
  if (!urlMatch) return false;

  // Check DOM indicators
  const domMatch = config.checkout.domIndicators.some(selector => {
    try {
      return document.querySelector(selector) !== null;
    } catch {
      return false;
    }
  });

  return domMatch;
}

/**
 * Find subtotal element and extract price
 */
function findSubtotal(config) {
  for (const selector of config.subtotal.selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || '';
        const priceMatch = text.match(PRICE_REGEX);
        if (priceMatch) {
          return {
            element,
            price: parseFloat(priceMatch[0].replace(/[$,]/g, '')),
          };
        }
      }
    } catch {
      // Invalid selector, skip
    }
  }
  return null;
}

/**
 * Generic heuristic for unknown sites
 */
function findSubtotalGeneric() {
  // Look for elements containing "total" with a price
  const candidates = document.querySelectorAll(
    '[class*="total" i], [id*="total" i], [data-testid*="total" i]'
  );

  for (const element of candidates) {
    const text = element.textContent || '';
    const priceMatch = text.match(PRICE_REGEX);
    if (priceMatch) {
      return {
        element,
        price: parseFloat(priceMatch[0].replace(/[$,]/g, '')),
      };
    }
  }

  return null;
}

/**
 * Request budget data from background worker
 */
async function requestBudget(domain, suggestedCategory) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: 'GET_BUDGET',
        domain,
        suggestedCategory,
      },
      resolve
    );
  });
}

/**
 * Main logic
 */
async function main() {
  const siteConfig = getSiteConfig();

  let subtotalResult = null;
  let suggestedCategory = null;
  let domain = window.location.hostname;

  if (siteConfig) {
    // Known site
    if (!isCheckoutPage(siteConfig.config)) {
      return; // Not a checkout page
    }
    subtotalResult = findSubtotal(siteConfig.config);
    suggestedCategory = siteConfig.config.category;
  } else {
    // Unknown site - try generic detection
    subtotalResult = findSubtotalGeneric();
  }

  if (!subtotalResult) {
    return; // No subtotal found
  }

  // Request budget data
  const budgetData = await requestBudget(domain, suggestedCategory);

  if (budgetData.error === 'not_configured') {
    return; // Extension not configured
  }

  // Inject overlay
  injectOverlay(subtotalResult.element, budgetData);

  // Watch for changes
  const observer = new MutationObserver(async () => {
    const newSubtotal = siteConfig
      ? findSubtotal(siteConfig.config)
      : findSubtotalGeneric();

    if (newSubtotal) {
      const newBudgetData = await requestBudget(domain, suggestedCategory);
      updateOverlay(newBudgetData);
    } else {
      removeOverlay();
    }
  });

  // Observe the subtotal element's parent for changes
  const parent = subtotalResult.element.parentElement;
  if (parent) {
    observer.observe(parent, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// Also run on URL changes (SPAs)
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    removeOverlay();
    setTimeout(main, 500); // Delay for SPA content to load
  }
});

urlObserver.observe(document.body, {
  childList: true,
  subtree: true,
});
```

- [ ] **Step 2: Commit content script**

```bash
git add src/content.js
git commit -m "feat: add content script with checkout detection and overlay injection"
```

---

## Task 9: Popup UI

**Files:**
- Create: `src/popup.html`
- Create: `src/popup.js`
- Create: `styles/popup.css`

- [ ] **Step 1: Create popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="../styles/popup.css">
</head>
<body>
  <div class="popup">
    <div class="popup__header">
      <h1 class="popup__title">Copilot Budget</h1>
    </div>

    <div class="popup__status" id="status">
      <div class="popup__status-icon" id="status-icon"></div>
      <div class="popup__status-text" id="status-text">Checking...</div>
    </div>

    <div class="popup__actions">
      <button class="popup__button" id="settings-btn">Settings</button>
      <button class="popup__button popup__button--secondary" id="refresh-btn">Refresh</button>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create popup.js**

```javascript
// src/popup.js
// Popup logic: status display, settings link

async function checkStatus() {
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

    if (response.connected) {
      statusIcon.className = 'popup__status-icon popup__status-icon--connected';
      statusText.textContent = 'Connected to Copilot';
    } else {
      statusIcon.className = 'popup__status-icon popup__status-icon--disconnected';
      if (response.reason === 'no_token') {
        statusText.textContent = 'Not configured';
      } else {
        statusText.textContent = 'Connection error';
      }
    }
  } catch (error) {
    statusIcon.className = 'popup__status-icon popup__status-icon--disconnected';
    statusText.textContent = 'Error';
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

document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('refresh-btn').addEventListener('click', refreshCache);

// Check status on load
checkStatus();
```

- [ ] **Step 3: Create popup.css**

```css
/* styles/popup.css */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 280px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}

.popup {
  padding: 16px;
}

.popup__header {
  margin-bottom: 16px;
}

.popup__title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.popup__status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 16px;
}

.popup__status-icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.popup__status-icon--connected {
  background: #4caf50;
}

.popup__status-icon--disconnected {
  background: #f44336;
}

.popup__status-text {
  font-size: 13px;
  color: #666;
}

.popup__actions {
  display: flex;
  gap: 8px;
}

.popup__button {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: #4caf50;
  color: white;
}

.popup__button:hover {
  background: #43a047;
}

.popup__button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.popup__button--secondary {
  background: #e0e0e0;
  color: #333;
}

.popup__button--secondary:hover {
  background: #d0d0d0;
}
```

- [ ] **Step 4: Commit popup**

```bash
git add src/popup.html src/popup.js styles/popup.css
git commit -m "feat: add extension popup with status display"
```

---

## Task 10: Settings Page

**Files:**
- Create: `src/settings.html`
- Create: `src/settings.js`
- Create: `styles/settings.css`
- Modify: `manifest.json` (add options_page)

- [ ] **Step 1: Create settings.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Copilot Budget Overlay - Settings</title>
  <link rel="stylesheet" href="../styles/settings.css">
</head>
<body>
  <div class="settings">
    <h1 class="settings__title">Copilot Budget Overlay Settings</h1>

    <section class="settings__section">
      <h2 class="settings__section-title">API Configuration</h2>

      <div class="settings__field">
        <label class="settings__label" for="copilot-token">Copilot API Token</label>
        <input type="password" id="copilot-token" class="settings__input" placeholder="Enter your Copilot API token">
        <p class="settings__hint">Required. Get this from your Copilot.money account settings.</p>
      </div>

      <div class="settings__field">
        <label class="settings__label" for="claude-key">Claude API Key (Optional)</label>
        <input type="password" id="claude-key" class="settings__input" placeholder="Enter your Claude API key">
        <p class="settings__hint">Optional. Enables AI categorization for unknown sites.</p>
      </div>
    </section>

    <section class="settings__section">
      <h2 class="settings__section-title">Extension</h2>

      <div class="settings__field settings__field--row">
        <label class="settings__label" for="enabled">Enable Extension</label>
        <input type="checkbox" id="enabled" class="settings__checkbox" checked>
      </div>
    </section>

    <section class="settings__section">
      <h2 class="settings__section-title">Domain Overrides</h2>
      <p class="settings__hint">Override the automatic category detection for specific domains.</p>

      <div id="overrides-list" class="settings__overrides"></div>

      <div class="settings__add-override">
        <input type="text" id="new-domain" class="settings__input settings__input--small" placeholder="domain.com">
        <select id="new-category" class="settings__select">
          <option value="">Select category</option>
        </select>
        <button id="add-override-btn" class="settings__button settings__button--small">Add</button>
      </div>
    </section>

    <div class="settings__actions">
      <button id="save-btn" class="settings__button">Save Settings</button>
      <span id="save-status" class="settings__save-status"></span>
    </div>
  </div>

  <script src="settings.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create settings.js**

```javascript
// src/settings.js
// Settings page logic

let categories = [];
let domainMappings = {};

async function loadSettings() {
  const result = await chrome.storage.local.get([
    'copilotToken',
    'claudeKey',
    'enabled',
    'domainMappings',
    'categories',
  ]);

  document.getElementById('copilot-token').value = result.copilotToken || '';
  document.getElementById('claude-key').value = result.claudeKey || '';
  document.getElementById('enabled').checked = result.enabled !== false;

  domainMappings = result.domainMappings || {};
  categories = result.categories || [];

  renderOverrides();
  populateCategorySelect();
}

function populateCategorySelect() {
  const select = document.getElementById('new-category');
  select.innerHTML = '<option value="">Select category</option>';

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  }
}

function renderOverrides() {
  const container = document.getElementById('overrides-list');
  container.innerHTML = '';

  for (const [domain, category] of Object.entries(domainMappings)) {
    const item = document.createElement('div');
    item.className = 'settings__override-item';
    item.innerHTML = `
      <span class="settings__override-domain">${domain}</span>
      <span class="settings__override-arrow">→</span>
      <span class="settings__override-category">${category}</span>
      <button class="settings__override-remove" data-domain="${domain}">×</button>
    `;
    container.appendChild(item);
  }

  // Add remove listeners
  container.querySelectorAll('.settings__override-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const domain = btn.dataset.domain;
      delete domainMappings[domain];
      renderOverrides();
    });
  });
}

function addOverride() {
  const domainInput = document.getElementById('new-domain');
  const categorySelect = document.getElementById('new-category');

  const domain = domainInput.value.trim().toLowerCase();
  const category = categorySelect.value;

  if (!domain || !category) {
    return;
  }

  domainMappings[domain] = category;
  domainInput.value = '';
  categorySelect.value = '';
  renderOverrides();
}

async function saveSettings() {
  const saveBtn = document.getElementById('save-btn');
  const saveStatus = document.getElementById('save-status');

  saveBtn.disabled = true;
  saveStatus.textContent = 'Saving...';

  try {
    await chrome.storage.local.set({
      copilotToken: document.getElementById('copilot-token').value,
      claudeKey: document.getElementById('claude-key').value,
      enabled: document.getElementById('enabled').checked,
      domainMappings,
    });

    // Refresh cache to pick up new token
    await chrome.runtime.sendMessage({ type: 'REFRESH_CACHE' });

    saveStatus.textContent = 'Saved!';
    saveStatus.className = 'settings__save-status settings__save-status--success';
  } catch (error) {
    saveStatus.textContent = 'Error saving';
    saveStatus.className = 'settings__save-status settings__save-status--error';
  } finally {
    saveBtn.disabled = false;
    setTimeout(() => {
      saveStatus.textContent = '';
    }, 2000);
  }
}

document.getElementById('add-override-btn').addEventListener('click', addOverride);
document.getElementById('save-btn').addEventListener('click', saveSettings);

// Load settings on page load
loadSettings();
```

- [ ] **Step 3: Create settings.css**

```css
/* styles/settings.css */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
  background: #f5f5f5;
  min-height: 100vh;
}

.settings {
  max-width: 600px;
  margin: 0 auto;
  padding: 32px;
  background: white;
  min-height: 100vh;
}

.settings__title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 32px;
  color: #1a1a1a;
}

.settings__section {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #eee;
}

.settings__section:last-of-type {
  border-bottom: none;
}

.settings__section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

.settings__field {
  margin-bottom: 16px;
}

.settings__field--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings__label {
  display: block;
  font-weight: 500;
  margin-bottom: 6px;
  color: #333;
}

.settings__input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.settings__input:focus {
  outline: none;
  border-color: #4caf50;
}

.settings__input--small {
  width: auto;
  flex: 1;
}

.settings__select {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  min-width: 150px;
}

.settings__checkbox {
  width: 20px;
  height: 20px;
}

.settings__hint {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.settings__overrides {
  margin-bottom: 12px;
}

.settings__override-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f9f9f9;
  border-radius: 6px;
  margin-bottom: 8px;
}

.settings__override-domain {
  font-family: monospace;
  color: #333;
}

.settings__override-arrow {
  color: #999;
}

.settings__override-category {
  color: #4caf50;
  font-weight: 500;
}

.settings__override-remove {
  margin-left: auto;
  background: none;
  border: none;
  color: #999;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.settings__override-remove:hover {
  color: #f44336;
}

.settings__add-override {
  display: flex;
  gap: 8px;
}

.settings__button {
  padding: 12px 24px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.settings__button:hover {
  background: #43a047;
}

.settings__button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.settings__button--small {
  padding: 10px 16px;
}

.settings__actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.settings__save-status {
  font-size: 13px;
}

.settings__save-status--success {
  color: #4caf50;
}

.settings__save-status--error {
  color: #f44336;
}
```

- [ ] **Step 4: Update manifest.json to add options_page**

Add after the `"icons"` section:

```json
"options_page": "src/settings.html"
```

- [ ] **Step 5: Commit settings page**

```bash
git add src/settings.html src/settings.js styles/settings.css manifest.json
git commit -m "feat: add settings page with token input and domain overrides"
```

---

## Task 11: Final Integration & Testing

**Files:**
- Verify all files work together

- [ ] **Step 1: Load extension in Chrome**

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `copilot-overlay` directory
5. Verify extension loads without errors

- [ ] **Step 2: Verify popup displays**

1. Click the extension icon in toolbar
2. Verify popup shows "Not configured" status
3. Click "Settings" button
4. Verify settings page opens

- [ ] **Step 3: Configure and test**

1. Enter Copilot API token in settings
2. Optionally enter Claude API key
3. Save settings
4. Verify popup shows "Connected to Copilot"

- [ ] **Step 4: Test on checkout page**

1. Go to amazon.com and add item to cart
2. Go to cart/checkout page
3. Verify budget overlay appears below subtotal
4. Verify correct category and budget amounts shown

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete copilot budget overlay extension v1.0"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Project scaffolding | manifest.json, icons/ |
| 2 | Site configs | site-configs.json |
| 3 | Overlay styling | overlay.css |
| 4 | Overlay component | overlay.js |
| 5 | Copilot API client | api/copilot.js |
| 6 | Claude API client | api/claude.js |
| 7 | Background worker | background.js |
| 8 | Content script | content.js |
| 9 | Popup UI | popup.html, popup.js, popup.css |
| 10 | Settings page | settings.html, settings.js, settings.css |
| 11 | Integration & testing | All files |

Total: 11 tasks, ~15 files, Chrome extension ready for use.
