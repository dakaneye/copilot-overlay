#!/usr/bin/env node
// native-host/index.js
// Native messaging host entry point - handles stdio communication

import { getToken, isExpired } from './keychain.js';
import * as playwright from './login/playwright.js';
import * as emailLink from './login/email-link.js';
import { appendFileSync } from 'node:fs';

const VERSION = '1.0.0';
const LOG_FILE = '/tmp/copilot-native-host.log';

function log(msg) {
  appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
}

const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB limit

/**
 * Read a native message from stdin
 * Native messaging uses 4-byte length prefix (little-endian)
 */
function readMessage() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let messageLength = null;

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        if (messageLength === null && buffer.length >= 4) {
          messageLength = buffer.readUInt32LE(0);
          if (messageLength > MAX_MESSAGE_SIZE) {
            reject(new Error(`Message too large: ${messageLength} bytes (max ${MAX_MESSAGE_SIZE})`));
            return;
          }
        }

        if (messageLength !== null && buffer.length >= 4 + messageLength) {
          const messageBuffer = buffer.subarray(4, 4 + messageLength);
          try {
            resolve(JSON.parse(messageBuffer.toString()));
          } catch (e) {
            reject(new Error('Invalid JSON message'));
          }
          return;
        }
      }
    });

    process.stdin.on('end', () => {
      reject(new Error('stdin closed'));
    });
  });
}

function writeMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json);
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buffer.length, 0);
  process.stdout.write(header);
  process.stdout.write(buffer);
}

async function handleGetToken() {
  const tokenData = await getToken();

  if (!tokenData) {
    return { type: 'NO_TOKEN' };
  }

  if (isExpired(tokenData.expiresAt)) {
    return { type: 'TOKEN_EXPIRED', expiresAt: tokenData.expiresAt };
  }

  return { type: 'TOKEN', token: tokenData.token, expiresAt: tokenData.expiresAt };
}

async function handleLogin(message) {
  const progress = (msg) => writeMessage(msg);

  // Try Playwright first
  let playwrightError = null;
  if (await playwright.isAvailable()) {
    try {
      const result = await playwright.login(progress);
      return { type: 'LOGIN_SUCCESS', token: result.token, expiresAt: result.expiresAt };
    } catch (error) {
      playwrightError = error.message;
    }
  }

  // Fall back to email-link if configured
  if (emailLink.isAvailable()) {
    const email = message.email;
    if (!email) {
      const reason = playwrightError
        ? `Playwright failed: ${playwrightError}`
        : 'Playwright not available';
      return { type: 'LOGIN_NEEDS_EMAIL', error: reason, message: 'Email required for fallback login' };
    }
    try {
      const result = await emailLink.login(email, progress);
      return { type: 'LOGIN_SUCCESS', token: result.token, expiresAt: result.expiresAt };
    } catch (error) {
      return { type: 'LOGIN_FAILED', error: `Email login failed: ${error.message}` };
    }
  }

  // Neither method available
  const reason = playwrightError
    ? `Playwright failed: ${playwrightError}`
    : 'Playwright not available';
  return { type: 'LOGIN_FAILED', error: `${reason}. Email login not configured (set COPILOT_FIREBASE_API_KEY).` };
}

async function handleStatus() {
  const playwrightAvailable = await playwright.isAvailable();
  return { type: 'STATUS_OK', version: VERSION, playwrightAvailable };
}

async function main() {
  log('Native host started');
  try {
    const message = await readMessage();
    log(`REQUEST: ${JSON.stringify(message)}`);
    let response;

    switch (message.type) {
      case 'GET_TOKEN':
        response = await handleGetToken();
        break;
      case 'LOGIN':
        response = await handleLogin(message);
        break;
      case 'STATUS':
        response = await handleStatus();
        break;
      default:
        response = { type: 'ERROR', error: `Unknown message type: ${message.type}` };
    }

    log(`RESPONSE: ${JSON.stringify(response)}`);
    writeMessage(response);
  } catch (error) {
    log(`ERROR: ${error.message}`);
    writeMessage({ type: 'ERROR', error: error.message });
  }

  process.exit(0);
}

main();
