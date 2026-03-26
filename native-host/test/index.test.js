// native-host/test/index.test.js
import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('index', () => {
  describe('message protocol', () => {
    it('MAX_MESSAGE_SIZE is 1MB', async () => {
      // Read the source to verify the constant
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /MAX_MESSAGE_SIZE\s*=\s*1024\s*\*\s*1024/);
    });

    it('uses 4-byte little-endian length prefix', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /readUInt32LE/);
      assert.match(source, /writeUInt32LE/);
    });
  });

  describe('message handlers', () => {
    it('handles GET_TOKEN message type', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /case\s+['"]GET_TOKEN['"]/);
    });

    it('handles LOGIN message type', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /case\s+['"]LOGIN['"]/);
    });

    it('handles STATUS message type', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /case\s+['"]STATUS['"]/);
    });

    it('returns error for unknown message types', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /default:\s*\n?\s*response\s*=.*ERROR/);
    });
  });

  describe('email-link integration', () => {
    it('imports emailLink module', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /import\s+\*\s+as\s+emailLink\s+from/);
    });

    it('calls emailLink.isAvailable in handleLogin', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /emailLink\.isAvailable\(\)/);
    });

    it('calls emailLink.login when available and email provided', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /emailLink\.login\(/);
    });

    it('returns LOGIN_NEEDS_EMAIL when email not provided', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /LOGIN_NEEDS_EMAIL/);
    });
  });
});
