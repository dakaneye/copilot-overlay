// native-host/test/keychain.test.js
import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock keytar before importing keychain
const mockKeytar = {
  getPassword: mock.fn(),
  setPassword: mock.fn(),
};

// Use dynamic import with mock
const originalModule = await import('../keychain.js');

describe('keychain', () => {
  describe('isExpired', () => {
    it('returns true when expiresAt is in the past', () => {
      const pastTime = Date.now() - 1000;
      assert.strictEqual(originalModule.isExpired(pastTime), true);
    });

    it('returns false when expiresAt is in the future', () => {
      const futureTime = Date.now() + 60000;
      assert.strictEqual(originalModule.isExpired(futureTime), false);
    });

    it('returns true when expiresAt is exactly now', () => {
      const now = Date.now();
      assert.strictEqual(originalModule.isExpired(now), true);
    });

    it('returns true for zero (invalid/corrupt timestamp)', () => {
      assert.strictEqual(originalModule.isExpired(0), true);
    });
  });
});
