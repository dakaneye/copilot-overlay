// native-host/test/playwright.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('playwright login module', () => {
  describe('exports', () => {
    it('exports isAvailable function', async () => {
      const playwright = await import('../login/playwright.js');
      assert.strictEqual(typeof playwright.isAvailable, 'function');
    });

    it('exports login function', async () => {
      const playwright = await import('../login/playwright.js');
      assert.strictEqual(typeof playwright.login, 'function');
    });
  });

  describe('constants', () => {
    it('imports TOKEN_TTL from shared constants', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/playwright.js', import.meta.url), 'utf8');
      assert.match(source, /import\s+\{\s*TOKEN_TTL\s*\}\s+from\s+['"]\.\.\/constants\.js['"]/);
    });

    it('uses correct Copilot URL', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/playwright.js', import.meta.url), 'utf8');
      assert.match(source, /COPILOT_URL\s*=\s*['"]https:\/\/app\.copilot\.money['"]/);
    });

    it('uses correct GraphQL URL', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/playwright.js', import.meta.url), 'utf8');
      assert.match(source, /GRAPHQL_URL\s*=\s*['"]https:\/\/api\.copilot\.money\/graphql['"]/);
    });
  });

  describe('token capture', () => {
    it('intercepts responses with page.on', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/playwright.js', import.meta.url), 'utf8');
      assert.match(source, /page\.on\(['"]response['"]/);
    });

    it('verifies successful response before capturing token', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/playwright.js', import.meta.url), 'utf8');
      assert.match(source, /body\.data\s*&&\s*!body\.errors/);
    });

    it('extracts Bearer token from authorization header', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/playwright.js', import.meta.url), 'utf8');
      assert.match(source, /startsWith\(['"]Bearer\s*['"]\)/);
    });

    it('saves token to keychain after capture', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/playwright.js', import.meta.url), 'utf8');
      assert.match(source, /saveToken\(/);
    });
  });

  describe('timeout handling', () => {
    it('has 5 minute timeout constant', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/playwright.js', import.meta.url), 'utf8');
      assert.match(source, /LOGIN_TIMEOUT_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
      assert.match(source, /LOGIN_TIMEOUT_MS\)/);
    });

    it('throws error on timeout', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/playwright.js', import.meta.url), 'utf8');
      assert.match(source, /throw new Error\(['"]Login timed out/);
    });
  });

  describe('resource cleanup', () => {
    it('closes browser in finally block', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/playwright.js', import.meta.url), 'utf8');
      assert.match(source, /finally\s*\{[\s\S]*?browser\.close\(\)/);
    });

    it('uses try/finally pattern for cleanup', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/playwright.js', import.meta.url), 'utf8');
      // Verify try block exists
      assert.match(source, /try\s*\{/);
      // Verify finally exists after try
      const tryPos = source.indexOf('try {');
      const finallyPos = source.indexOf('finally {');
      assert.ok(tryPos > 0 && finallyPos > tryPos, 'finally should come after try');
    });
  });
});
