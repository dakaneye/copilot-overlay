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

// Native messaging
const NATIVE_HOST = 'com.copilot.budget_overlay';
let authMode = 'unknown'; // 'native' | 'manual' | 'unknown'
let loginInProgress = false;
let nativeTokenExpiresAt = 0;
let loginStartedAt = 0;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes - match native host timeout

/**
 * Get stored tokens - from native host or manual storage
 */
async function getTokens() {
  // If native auth mode and we have a non-expired token, refresh from native
  if (authMode === 'native' && nativeTokenExpiresAt > Date.now()) {
    try {
      const response = await sendNativeMessage({ type: 'GET_TOKEN' });
      if (response.type === 'TOKEN') {
        await chrome.storage.local.set({ copilotToken: response.token });
        nativeTokenExpiresAt = response.expiresAt;
      }
    } catch {
      // Fall through to storage
    }
  }

  const result = await chrome.storage.local.get(['copilotToken', 'claudeKey']);
  return {
    copilotToken: result.copilotToken || null,
    claudeKey: result.claudeKey || null,
  };
}

/**
 * Send native message and await response (with timeout)
 */
function sendNativeMessage(message, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Native message timeout'));
    }, timeoutMs);

    chrome.runtime.sendNativeMessage(NATIVE_HOST, message, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Initialize auth - check for native host, fall back to manual
 */
async function initAuth() {
  try {
    const status = await sendNativeMessage({ type: 'STATUS' });
    if (status.type === 'STATUS_OK') {
      authMode = 'native';
      const tokenResponse = await sendNativeMessage({ type: 'GET_TOKEN' });
      await handleNativeTokenResponse(tokenResponse);
    }
  } catch {
    authMode = 'manual';
  }
}

/**
 * Handle token response from native host
 */
async function handleNativeTokenResponse(response) {
  if (response.type === 'TOKEN') {
    // Store token in chrome.storage for existing code to use
    await chrome.storage.local.set({ copilotToken: response.token });
    nativeTokenExpiresAt = response.expiresAt;
  }
  // NO_TOKEN and TOKEN_EXPIRED are handled by user clicking Login button
}

/**
 * Check if login is in progress (survives service worker restart)
 */
async function isLoginInProgress() {
  if (loginInProgress) return true;

  // Check storage for persisted login state
  const { loginStarted } = await chrome.storage.local.get(['loginStarted']);
  if (loginStarted && Date.now() - loginStarted < LOGIN_TIMEOUT_MS) {
    loginInProgress = true;
    loginStartedAt = loginStarted;
    return true;
  }
  return false;
}

/**
 * Trigger native login with mutex
 */
async function triggerNativeLogin() {
  if (await isLoginInProgress()) return;
  loginInProgress = true;
  loginStartedAt = Date.now();
  await chrome.storage.local.set({ loginStarted: loginStartedAt });

  chrome.notifications.create('copilot-auth', {
    type: 'basic',
    iconUrl: 'icons/icon-48.png',
    title: 'Copilot Budget',
    message: 'Authenticating...',
  });

  try {
    const result = await sendNativeMessage({ type: 'LOGIN' });

    if (result.type === 'LOGIN_SUCCESS') {
      await chrome.storage.local.set({ copilotToken: result.token });
      nativeTokenExpiresAt = result.expiresAt;

      chrome.notifications.create('copilot-auth-success', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Copilot Budget',
        message: 'Authenticated successfully',
      });
    } else if (result.type === 'LOGIN_EMAIL_SENT') {
      chrome.notifications.create('copilot-auth-email', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Copilot Budget',
        message: 'Check your email to complete login',
        requireInteraction: true,
      });
    } else if (result.type === 'LOGIN_FAILED') {
      chrome.notifications.create('copilot-auth-failed', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Copilot Budget',
        message: `Authentication failed: ${result.error}`,
      });
    }
  } finally {
    loginInProgress = false;
    await chrome.storage.local.remove(['loginStarted']);
  }
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
    // If auth error, clear token (user can re-login via popup)
    if (error.isAuthError) {
      await chrome.storage.local.remove(['copilotToken']);
      nativeTokenExpiresAt = 0;
    }
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

// Lazy init
let authInitialized = false;
async function ensureAuthInitialized() {
  if (!authInitialized) {
    authInitialized = true;
    await initAuth();
  }
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, domain, suggestedCategory } = message;

  if (type === 'PING') {
    sendResponse({ type: 'PONG', timestamp: Date.now() });
    return true;
  }

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

  if (type === 'GET_AUTH_STATUS') {
    sendResponse({
      authMode,
      nativeTokenExpiresAt,
      loginInProgress,
    });
    ensureAuthInitialized();
    return true;
  }

  if (type === 'TRIGGER_LOGIN') {
    if (authMode === 'native') {
      triggerNativeLogin().then(() => sendResponse({ success: true }));
    } else {
      sendResponse({ error: 'Native host not available' });
    }
    return true;
  }

  return false;
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  initAuth();
});

// Also sync token when service worker starts
initAuth();
