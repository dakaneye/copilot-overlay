# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm run build              # Build extension (esbuild bundles src/ → dist/)
npm run watch              # Watch mode with inline sourcemaps

cd native-host && npm test # Run all 43 native-host tests (node:test runner)
cd native-host && node --test test/keychain.test.js  # Run a single test file
```

## Quality Gates - MANDATORY Before Every Commit

ALL gates must pass. No exceptions.

1. **Build**: `npm run build`
2. **Tests**: `cd native-host && npm test` (43/43 passing)
3. **Lint**: No `console.log` in `src/` (console.error is ok), no `debugger` statements
4. **Security**: No hardcoded secrets/tokens/keys, no `eval`/`new Function` in src/
5. **Code review**: Run `/review-code` on changed files. Must receive A grade (90+).

## Architecture

Chrome extension (Manifest V3) that overlays Copilot.money budget info on checkout pages.

**Two separate packages:**
- Root (`package.json`) — Chrome extension built with esbuild
- `native-host/` (`native-host/package.json`) — Node.js native messaging host

**Data flow:**
```
content.js (detects checkout, reads subtotal)
    → background.js (service worker)
        → native host (reads token from macOS Keychain via keytar)
        → Copilot GraphQL API (fetches budgets/categories)
        → Claude Haiku API (categorizes unknown domains)
    → overlay.js (renders budget overlay on page)
```

**Key architectural constraints:**
- Chrome sandbox prevents direct keychain access — native messaging bridge (`com.copilot.budget_overlay`) is required
- Auth tokens come from the `copilot-auth` CLI daemon (separate `@dakaneye-js/copilot-money-mcp` package), stored in macOS Keychain under service `copilot-money-mcp`
- Background service worker caches budgets (15min TTL) and categories (1hr TTL) in memory
- Site detection uses both URL patterns and DOM indicators (defined in `site-configs.json`)

**Native host message types:** `GET_TOKEN`, `LOGIN`, `STATUS` (see `native-host/README.md` for full protocol)

## Key Files

| File | Purpose |
|------|---------|
| `src/background.js` | Service worker: token management, API calls, caching |
| `src/content.js` | Injected into checkout pages, finds subtotals |
| `src/overlay.js` | Budget overlay DOM injection and updates |
| `src/site-configs.json` | Per-site selectors, URL patterns, categories |
| `src/api/copilot.js` | Copilot GraphQL API client |
| `src/api/claude.js` | Claude Haiku domain categorization |
| `native-host/index.js` | Native messaging entry point (stdio protocol) |
| `native-host/keychain.js` | macOS Keychain token read/write via keytar |
| `native-host/install.sh` | Registers native host with browser |
| `build.js` | esbuild config, copies static files to dist/ |

## Adding Site Support

Edit `src/site-configs.json` with selectors found via browser DevTools, then `npm run build`. Also add the domain to `manifest.json` in both `host_permissions` and `content_scripts.matches`.

## Debugging Auth Issues

```bash
copilot-auth status                    # Check daemon and token status
tail -f /tmp/copilot-native-host.log   # Native host logs
```
