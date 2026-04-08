#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || { echo "Error: failed to determine script directory" >&2; exit 1; }
HOST_PATH="$SCRIPT_DIR/index.js"

# Verify host exists
if [[ ! -f "$HOST_PATH" ]]; then
  echo "Error: index.js not found at $HOST_PATH" >&2
  exit 1
fi

# Parse arguments
EXTENSION_ID=""
BROWSER="arc"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --extension-id=*) EXTENSION_ID="${1#*=}"; shift ;;
    arc|chrome|chromium) BROWSER="$1"; shift ;;
    *) echo "Usage: ./install.sh --extension-id=ID [arc|chrome|chromium]" >&2; exit 1 ;;
  esac
done

if [[ -z "$EXTENSION_ID" ]]; then
  echo "Error: --extension-id is required" >&2
  echo "" >&2
  echo "To find your extension ID:" >&2
  echo "  1. Load the extension in your browser (chrome://extensions)" >&2
  echo "  2. Enable 'Developer mode'" >&2
  echo "  3. Copy the ID shown under the extension name" >&2
  echo "" >&2
  echo "Usage: ./install.sh --extension-id=abcdefghijklmnop [arc|chrome|chromium]" >&2
  exit 1
fi

# Validate extension ID format (32 lowercase letters)
if [[ ! "$EXTENSION_ID" =~ ^[a-p]{32}$ ]]; then
  echo "Error: Invalid extension ID format" >&2
  echo "Extension IDs are 32 characters using only letters a-p" >&2
  exit 1
fi

case "$BROWSER" in
  arc)     MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" ;; # Arc reads from Chrome's path
  chrome)  MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" ;;
  chromium) MANIFEST_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts" ;;
esac

mkdir -p "$MANIFEST_DIR" || { echo "Error: failed to create $MANIFEST_DIR" >&2; exit 1; }

cat > "$MANIFEST_DIR/com.copilot.budget_overlay.json" << EOF || { echo "Error: failed to write manifest" >&2; exit 1; }
{
  "name": "com.copilot.budget_overlay",
  "description": "Copilot Budget Overlay Native Host",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
EOF

echo "✓ Installed native messaging manifest to $MANIFEST_DIR"
echo ""
echo "Next steps:"
echo "  cd $SCRIPT_DIR && npm install"
echo ""
echo "Then reload the extension in your browser."
