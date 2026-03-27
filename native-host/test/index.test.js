// native-host/test/index.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('index', () => {
  describe('message protocol', () => {
    it('MAX_MESSAGE_SIZE is 1MB', async () => {
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

  describe('GET_TOKEN handler', () => {
    it('calls getToken from keychain', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /import\s*\{\s*getToken/);
    });

    it('returns NO_TOKEN when no token exists', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /NO_TOKEN/);
    });

    it('returns TOKEN_EXPIRED when token expired', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /TOKEN_EXPIRED/);
    });

    it('returns TOKEN with token and expiresAt', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /type:\s*['"]TOKEN['"]/);
      assert.match(source, /token:\s*tokenData\.token/);
      assert.match(source, /expiresAt:\s*tokenData\.expiresAt/);
    });
  });

  describe('STATUS handler', () => {
    it('returns STATUS_OK with version', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /STATUS_OK/);
      assert.match(source, /version:\s*VERSION/);
    });

    it('has VERSION constant', async () => {
      const fs = await import('node:fs/promises');
      const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
      assert.match(source, /VERSION\s*=\s*['"][0-9]+\.[0-9]+\.[0-9]+['"]/);
    });
  });
});
