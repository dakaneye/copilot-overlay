// native-host/test/install.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';

describe('install.sh', () => {
  let source;

  before(async () => {
    source = await readFile(new URL('../install.sh', import.meta.url), 'utf8');
  });

  describe('shell safety', () => {
    it('uses strict mode', () => {
      assert.match(source, /set -euo pipefail/);
    });

    it('uses BASH_SOURCE for script directory', () => {
      assert.match(source, /\$\{BASH_SOURCE\[0\]\}/);
    });

    it('redirects errors to stderr', () => {
      // Count >&2 occurrences - should have several
      const stderrCount = (source.match(/>&2/g) || []).length;
      assert.ok(stderrCount >= 5, `Expected at least 5 stderr redirects, got ${stderrCount}`);
    });
  });

  describe('input validation', () => {
    it('requires --extension-id parameter', () => {
      assert.match(source, /--extension-id is required/);
    });

    it('validates extension ID format', () => {
      assert.match(source, /\[a-p\]\{32\}/);
    });

    it('validates extension ID is 32 characters', () => {
      assert.match(source, /32/);
    });
  });

  describe('file operations', () => {
    it('verifies host path exists before install', () => {
      assert.match(source, /\[\[\s+!\s+-f\s+"\$HOST_PATH"\s+\]\]/);
    });

    it('creates manifest directory with mkdir -p', () => {
      assert.match(source, /mkdir -p "\$MANIFEST_DIR"/);
    });

    it('has error handling for mkdir', () => {
      assert.match(source, /mkdir.*\|\|\s*\{.*Error.*\}/s);
    });
  });

  describe('browser support', () => {
    it('defaults to arc browser', () => {
      assert.match(source, /BROWSER="arc"/);
    });

    it('supports chrome', () => {
      assert.match(source, /chrome\)/);
      assert.match(source, /Google\/Chrome/);
    });

    it('supports chromium', () => {
      assert.match(source, /chromium\)/);
      assert.match(source, /Chromium/);
    });

    it('supports arc', () => {
      assert.match(source, /arc\)/);
      assert.match(source, /Arc/);
    });
  });

  describe('manifest content', () => {
    it('sets correct native host name', () => {
      assert.match(source, /com\.copilot\.budget_overlay/);
    });

    it('uses stdio type', () => {
      assert.match(source, /"type":\s*"stdio"/);
    });

    it('includes extension ID in allowed_origins', () => {
      assert.match(source, /chrome-extension:\/\/\$EXTENSION_ID/);
    });
  });
});
