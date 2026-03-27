// native-host/test/keychain.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isExpired } from '../keychain.js';

describe('keychain', () => {
  describe('isExpired', () => {
    it('returns true when expiresAt is in the past', () => {
      const pastTime = Date.now() - 1000;
      assert.strictEqual(isExpired(pastTime), true);
    });

    it('returns false when expiresAt is in the future', () => {
      const futureTime = Date.now() + 60000;
      assert.strictEqual(isExpired(futureTime), false);
    });

    it('returns true when expiresAt is exactly now', () => {
      const now = Date.now();
      assert.strictEqual(isExpired(now), true);
    });

    it('returns true for zero (invalid/corrupt timestamp)', () => {
      assert.strictEqual(isExpired(0), true);
    });
  });

  describe('getToken', () => {
    it('reads from copilot-money-auth service', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../keychain.js', import.meta.url), 'utf8');
      assert.match(source, /SERVICE\s*=\s*['"]copilot-money-auth['"]/);
    });

    it('parses JSON from keychain', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../keychain.js', import.meta.url), 'utf8');
      assert.match(source, /JSON\.parse\(/);
    });

    it('returns null for invalid JSON', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../keychain.js', import.meta.url), 'utf8');
      assert.match(source, /catch[\s\S]*?return null/);
    });

    it('validates token and expiresAt fields', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../keychain.js', import.meta.url), 'utf8');
      assert.match(source, /!token\s*\|\|\s*typeof expiresAt !== ['"]number['"]/);
    });

    it('returns object with token and expiresAt', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../keychain.js', import.meta.url), 'utf8');
      assert.match(source, /return\s*\{\s*token,\s*expiresAt\s*\}/);
    });
  });
});
