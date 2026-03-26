#!/usr/bin/env node
// native-host/index.js
// Native messaging host entry point - handles stdio communication

import { getToken, isExpired } from './keychain.js';
import * as playwright from './login/playwright.js';
import * as emailLink from './login/email-link.js';

const VERSION = '1.0.0';

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
        }

        if (messageLength !== null && buffer.length >= 4 + messageLength) {
          const messageBuffer = buffer.slice(4, 4 + messageLength);
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

/**
 * Write a native message to stdout
 */
function writeMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json);
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buffer.length, 0);
  process.stdout.write(header);
  process.stdout.write(buffer);
}

/**
 * Handle GET_TOKEN message
 */
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

/**
 * Handle LOGIN message
 */
async function handleLogin() {
  const progress = (msg) => writeMessage(msg);

  // Try Playwright first
  if (await playwright.isAvailable()) {
    try {
      const result = await playwright.login(progress);
      return { type: 'LOGIN_SUCCESS', token: result.token, expiresAt: result.expiresAt };
    } catch (error) {
      // Fall through to email-link
    }
  }

  // Fall back to email-link
  // For now, we don't have cached email - return error
  // In full implementation, we'd prompt or use cached email
  return { type: 'LOGIN_FAILED', error: 'Email login not yet implemented - use Playwright' };
}

/**
 * Handle STATUS message
 */
async function handleStatus() {
  const playwrightAvailable = await playwright.isAvailable();
  return { type: 'STATUS_OK', version: VERSION, playwrightAvailable };
}

/**
 * Main entry point
 */
async function main() {
  try {
    const message = await readMessage();
    let response;

    switch (message.type) {
      case 'GET_TOKEN':
        response = await handleGetToken();
        break;
      case 'LOGIN':
        response = await handleLogin();
        break;
      case 'STATUS':
        response = await handleStatus();
        break;
      default:
        response = { type: 'ERROR', error: `Unknown message type: ${message.type}` };
    }

    writeMessage(response);
  } catch (error) {
    writeMessage({ type: 'ERROR', error: error.message });
  }

  process.exit(0);
}

main();
