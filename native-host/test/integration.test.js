// native-host/test/integration.test.js
// Integration tests for native messaging protocol
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(__dirname, '..', 'index.js');

/**
 * Send a native message and receive response
 * @param {object} message - Message to send
 * @returns {Promise<object>} - Response message
 */
function sendNativeMessage(message) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [INDEX_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const chunks = [];

    child.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}`));
        return;
      }

      const buffer = Buffer.concat(chunks);
      if (buffer.length < 4) {
        reject(new Error('Response too short'));
        return;
      }

      const length = buffer.readUInt32LE(0);
      const json = buffer.slice(4, 4 + length).toString();

      try {
        resolve(JSON.parse(json));
      } catch (e) {
        reject(new Error(`Invalid JSON response: ${json}`));
      }
    });

    child.on('error', reject);

    // Send message with 4-byte length prefix
    const json = JSON.stringify(message);
    const msgBuffer = Buffer.from(json);
    const header = Buffer.alloc(4);
    header.writeUInt32LE(msgBuffer.length);

    child.stdin.write(header);
    child.stdin.write(msgBuffer);
    child.stdin.end();
  });
}

describe('native messaging integration', () => {
  describe('STATUS message', () => {
    it('returns STATUS_OK with version', async () => {
      const response = await sendNativeMessage({ type: 'STATUS' });

      assert.strictEqual(response.type, 'STATUS_OK');
      assert.strictEqual(response.version, '1.0.0');
      assert.strictEqual(typeof response.playwrightAvailable, 'boolean');
    });
  });

  describe('GET_TOKEN message', () => {
    it('returns token status', async () => {
      const response = await sendNativeMessage({ type: 'GET_TOKEN' });

      // Should be one of: TOKEN, NO_TOKEN, or TOKEN_EXPIRED
      assert.ok(
        ['TOKEN', 'NO_TOKEN', 'TOKEN_EXPIRED'].includes(response.type),
        `Unexpected response type: ${response.type}`
      );
    });
  });

  describe('unknown message', () => {
    it('returns ERROR for unknown type', async () => {
      const response = await sendNativeMessage({ type: 'UNKNOWN_TYPE' });

      assert.strictEqual(response.type, 'ERROR');
      assert.match(response.error, /Unknown message type/);
    });
  });

  describe('message protocol', () => {
    it('handles valid JSON message', async () => {
      const response = await sendNativeMessage({ type: 'STATUS' });
      assert.ok(response.type, 'Response should have type field');
    });
  });
});
