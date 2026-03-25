// src/background.js
// Background service worker: API calls, caching, categorization

import { fetchCategories, fetchAllBudgets } from './api/copilot.js';
import { categorizeWithHaiku } from './api/claude.js';
import siteConfigs from './site-configs.json';

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
    // Also save to storage for settings page
    await chrome.storage.local.set({ categories });
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

  // Check if extension is enabled
  const { enabled } = await chrome.storage.local.get(['enabled']);
  if (enabled === false) {
    return { error: 'disabled' };
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
