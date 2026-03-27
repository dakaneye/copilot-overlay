# Claude Instructions for copilot-overlay

## Quality Gates - MANDATORY Before Every Commit

**ALL gates must pass before committing. No exceptions.**

### 1. Build
```bash
npm run build
```

### 2. Tests (must be 42/42 passing)
```bash
cd native-host && npm test && cd ..
```

### 3. Lint checks
```bash
# No console.log in src/ (console.error is ok)
grep -rn "console.log" src/*.js src/**/*.js 2>/dev/null | grep -v "console.error"

# No debugger statements
grep -rn "debugger" src/
```

### 4. Security scan
```bash
# No hardcoded secrets/tokens/keys
grep -rn --include="*.js" --include="*.json" -E "(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][^'\"]+['\"]" . | grep -v node_modules | grep -v package-lock

# No eval or Function constructor with user input
grep -rn "eval\|new Function" src/
```

### 5. Code review - MUST BE A GRADE
Run `/review-code` on changed files. **Must receive A grade (90+) before committing.**

If grade is below A:
- Fix all BLOCKER issues
- Fix all MAJOR issues
- Re-run review until A grade achieved

**Do not skip or bypass any gate.**

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
| `native-host/keychain.js` | Keychain token access |

## Common Tasks

### Adding site support
Edit `src/site-configs.json` with selectors found via browser DevTools.

### Debugging auth issues
```bash
copilot-auth status  # Check daemon and token status
tail -f /tmp/copilot-native-host.log  # Native host logs
```
