// native-host/login/playwright.js
// Playwright-based login - intercepts GraphQL requests to capture token

import { chromium } from 'playwright';
import { saveToken } from '../keychain.js';
import { TOKEN_TTL } from '../constants.js';
import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const COPILOT_URL = 'https://app.copilot.money';
const GRAPHQL_URL = 'https://api.copilot.money/graphql';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_FILE = join(tmpdir(), 'copilot-login.lock');

function acquireLock() {
  // Check if lock exists and is recent (within timeout)
  if (existsSync(LOCK_FILE)) {
    try {
      const lockTime = parseInt(readFileSync(LOCK_FILE, 'utf8'), 10);
      if (Date.now() - lockTime < LOGIN_TIMEOUT_MS) {
        return false; // Lock is held
      }
    } catch {
      // Corrupted lock file, proceed to overwrite
    }
  }
  writeFileSync(LOCK_FILE, Date.now().toString());
  return true;
}

function releaseLock() {
  try {
    unlinkSync(LOCK_FILE);
  } catch {
    // Ignore errors
  }
}

export async function isAvailable() {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

export async function login(onProgress) {
  if (!acquireLock()) {
    throw new Error('Login already in progress');
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    let capturedToken = null;

    // Intercept responses to capture token only after successful auth
    page.on('response', async (response) => {
      if (response.url().startsWith(GRAPHQL_URL) && response.status() === 200) {
        const request = response.request();
        const auth = request.headers()['authorization'];
        if (auth?.startsWith('Bearer ')) {
          // Verify this is a successful response (not an auth error)
          try {
            const body = await response.json();
            if (body.data && !body.errors) {
              capturedToken = auth.slice(7);
            }
          } catch {
            // Response not JSON or failed to parse
          }
        }
      }
    });

    onProgress?.({ type: 'LOGIN_STARTED', method: 'playwright' });

    await page.goto(COPILOT_URL);

    const startTime = Date.now();

    while (!capturedToken && Date.now() - startTime < LOGIN_TIMEOUT_MS) {
      await page.waitForTimeout(500);
    }

    if (!capturedToken) {
      throw new Error('Login timed out - no token captured');
    }

    const expiresAt = Date.now() + TOKEN_TTL;
    await saveToken(capturedToken, expiresAt);

    return { token: capturedToken, expiresAt };
  } finally {
    if (browser) await browser.close();
    releaseLock();
  }
}
