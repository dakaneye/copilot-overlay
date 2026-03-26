// native-host/test/email-link.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('email-link login module', () => {
  describe('exports', () => {
    it('exports isAvailable function', async () => {
      const emailLink = await import('../login/email-link.js');
      assert.strictEqual(typeof emailLink.isAvailable, 'function');
    });

    it('exports login function', async () => {
      const emailLink = await import('../login/email-link.js');
      assert.strictEqual(typeof emailLink.login, 'function');
    });
  });

  describe('environment configuration', () => {
    it('reads COPILOT_FIREBASE_API_KEY from env', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /process\.env\.COPILOT_FIREBASE_API_KEY/);
    });

    it('isAvailable checks API key', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /Boolean\(FIREBASE_API_KEY\)/);
    });
  });

  describe('GraphQL security', () => {
    it('uses GraphQL variables instead of string interpolation', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      // Should have $token variable in query
      assert.match(source, /\$token:\s*String!/);
      // Should have variables object
      assert.match(source, /variables:\s*\{\s*token:/);
    });
  });

  describe('HTTP callback server', () => {
    it('creates server with node:http', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /import\s*\{\s*createServer\s*\}\s*from\s*['"]node:http['"]/);
    });

    it('listens on callback path', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /\/callback/);
    });

    it('extracts oobCode from query params', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /searchParams\.get\(['"]oobCode['"]\)/);
    });
  });

  describe('timeout handling', () => {
    it('sets timeout AFTER server.listen', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      // Find the positions - server.listen should come before setTimeout
      const listenPos = source.indexOf("server.listen(port, '127.0.0.1')");
      const timeoutPos = source.indexOf('timeout = setTimeout');
      assert.ok(listenPos > 0, 'server.listen should exist');
      assert.ok(timeoutPos > 0, 'setTimeout should exist');
      assert.ok(listenPos < timeoutPos, 'server.listen should come before setTimeout');
    });

    it('has 5 minute timeout constant', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /LOGIN_TIMEOUT_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
      assert.match(source, /LOGIN_TIMEOUT_MS\)/);
    });

    it('clears timeout on success', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /clearTimeout\(timeout\)/);
    });
  });

  describe('error handling', () => {
    it('throws on missing Firebase config', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /throw new Error\(\s*['"]Firebase configuration required/);
    });

    it('throws on failed email send', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /throw new Error\(['"]Failed to send email link['"]\)/);
    });

    it('validates email format before sending', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /EMAIL_REGEX/);
      assert.match(source, /throw new Error\(['"]Valid email address required['"]\)/);
    });

    it('validates Firebase response before using', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /verifyResponse\.ok/);
      assert.match(source, /verifyData\.idToken/);
    });

    it('validates Copilot response before using', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /copilotResponse\.ok/);
      assert.match(source, /copilotData\.data\?\.loginWithFirebase\?\.accessToken/);
    });
  });

  describe('localhost binding', () => {
    it('binds HTTP server to localhost only', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /server\.listen\(port,\s*['"]127\.0\.0\.1['"]\)/);
    });

    it('binds getAvailablePort to localhost', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../login/email-link.js', import.meta.url), 'utf8');
      assert.match(source, /server\.listen\(0,\s*['"]127\.0\.0\.1['"]/);
    });
  });
});
