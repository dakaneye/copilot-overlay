// src/content.js
// Content script: detect checkout, find subtotal, inject overlay

import { injectOverlay, updateOverlay, removeOverlay } from './overlay.js';
import siteConfigs from './site-configs.json';

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
 * Try to detect checkout and inject overlay. Returns true if successful.
 */
async function tryInject() {
  const siteConfig = getSiteConfig();

  let subtotalResult = null;
  let suggestedCategory = null;
  let domain = window.location.hostname;

  if (siteConfig) {
    // Known site — check URL first (cheap), then DOM
    const url = window.location.pathname;
    const urlMatch = siteConfig.config.checkout.urlPatterns.some(pattern =>
      url.includes(pattern)
    );
    if (!urlMatch) return false;

    if (!isCheckoutPage(siteConfig.config)) return false;

    subtotalResult = findSubtotal(siteConfig.config);
    suggestedCategory = siteConfig.config.category;
  } else {
    subtotalResult = findSubtotalGeneric();
  }

  if (!subtotalResult) return false;

  const budgetData = await requestBudget(domain, suggestedCategory);

  if (budgetData.error === 'not_configured' || budgetData.error === 'disabled') {
    return false;
  }

  injectOverlay(subtotalResult.element, budgetData);

  // Watch for subtotal changes
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

  const parent = subtotalResult.element.parentElement;
  if (parent) {
    observer.observe(parent, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  return true;
}

/**
 * Main logic — retries for SPAs where checkout DOM loads after content script
 */
async function main() {
  if (await tryInject()) return;

  // Retry with increasing delays for SPA content to render
  const delays = [500, 1000, 2000, 4000];
  for (const delay of delays) {
    await new Promise(resolve => setTimeout(resolve, delay));
    if (document.getElementById('copilot-budget-overlay')) return;
    if (await tryInject()) return;
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
