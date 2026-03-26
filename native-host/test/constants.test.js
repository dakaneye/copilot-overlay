// native-host/test/constants.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TOKEN_TTL } from '../constants.js';

describe('constants', () => {
  describe('TOKEN_TTL', () => {
    it('is 1 hour in milliseconds', () => {
      assert.strictEqual(TOKEN_TTL, 3600000);
    });

    it('is a number', () => {
      assert.strictEqual(typeof TOKEN_TTL, 'number');
    });
  });
});
