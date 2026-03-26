# Claude Instructions for copilot-overlay

## Quality Gates - MANDATORY Before Every Commit

Run ALL of these before committing. No exceptions.

```bash
# 1. Build extension
npm run build

# 2. Run native-host tests (must be 67/67 passing)
cd native-host && npm test && cd ..

# 3. Check for console.log (none allowed in src/)
grep -rn "console.log" src/*.js src/**/*.js 2>/dev/null | grep -v "console.error"

# 4. Check for debugger statements
grep -rn "debugger" src/
```

**If any check fails, fix it before committing.**

## Project Structure

- `src/` - Extension source (content scripts, background worker, popup)
- `native-host/` - Node.js native messaging host (keychain, login)
- `dist/` - Built extension (gitignored)
- `.superpowers/` - Dev docs (gitignored)

## Key Files

| File | Purpose |
|------|---------|
| `src/background.js` | Service worker, API calls, caching |
| `src/content.js` | Injected into checkout pages |
| `src/site-configs.json` | Site selectors and categories |
| `native-host/login/playwright.js` | Browser-based login flow |

## Common Tasks

### Adding site support
Edit `src/site-configs.json` with selectors found via browser DevTools.

### Debugging login issues
Check `/tmp/copilot-native-host.log` for native host logs.

### Testing native host manually
```bash
cd native-host
echo '{"type":"STATUS"}' | node index.js
```
