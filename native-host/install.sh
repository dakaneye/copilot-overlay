#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_PATH="$SCRIPT_DIR/index.js"

# Parse arguments
EXTENSION_ID=""
BROWSER="arc"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --extension-id=*) EXTENSION_ID="${1#*=}"; shift ;;
    arc|chrome|chromium) BROWSER="$1"; shift ;;
    *) echo "Usage: ./install.sh [--extension-id=ID] [arc|chrome|chromium]"; exit 1 ;;
  esac
done

if [[ -z "$EXTENSION_ID" ]]; then
  echo "Error: --extension-id is required"
  echo ""
  echo "To find your extension ID:"
  echo "  1. Load the extension in your browser (chrome://extensions)"
  echo "  2. Enable 'Developer mode'"
  echo "  3. Copy the ID shown under the extension name"
  echo ""
  echo "Usage: ./install.sh --extension-id=abcdefghijklmnop [arc|chrome|chromium]"
  exit 1
fi

case "$BROWSER" in
  arc)     MANIFEST_DIR="$HOME/Library/Application Support/Arc/User Data/NativeMessagingHosts" ;;
  chrome)  MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" ;;
  chromium) MANIFEST_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts" ;;
esac

mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_DIR/com.copilot.budget_overlay.json" << EOF
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
