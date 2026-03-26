// native-host/login/playwright.js
// Playwright-based login - intercepts GraphQL requests to capture token

import { chromium } from 'playwright';
import { saveToken } from '../keychain.js';
import { TOKEN_TTL } from '../constants.js';

const COPILOT_URL = 'https://app.copilot.money';
const GRAPHQL_URL = 'https://api.copilot.money/graphql';

/**
 * Check if Playwright is available
 * @returns {Promise<boolean>}
 */
export async function isAvailable() {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Login via Playwright browser automation
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise<{token: string, expiresAt: number}>}
 */
export async function login(onProgress) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  let capturedToken = null;

  // Intercept requests to capture token
  page.on('request', (request) => {
    if (request.url().startsWith(GRAPHQL_URL)) {
      const auth = request.headers()['authorization'];
      if (auth?.startsWith('Bearer ')) {
        capturedToken = auth.slice(7);
      }
    }
  });

  onProgress?.({ type: 'LOGIN_STARTED', method: 'playwright' });

  await page.goto(COPILOT_URL);

  // Wait for user to complete login and for a GraphQL request with token
  const timeout = 5 * 60 * 1000; // 5 minute timeout
  const startTime = Date.now();

  while (!capturedToken && Date.now() - startTime < timeout) {
    await page.waitForTimeout(500);
  }

  await browser.close();

  if (!capturedToken) {
    throw new Error('Login timed out - no token captured');
  }

  const expiresAt = Date.now() + TOKEN_TTL;
  await saveToken(capturedToken, expiresAt);

  return { token: capturedToken, expiresAt };
}
