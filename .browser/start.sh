#!/bin/bash
# Launch Chrome with CDP for browser automation
# Uses persistent profile in .browser/data for session persistence

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_DATA_DIR="$SCRIPT_DIR/data"
CDP_PORT="${CDP_PORT:-9920}"

# Create data directory if it doesn't exist
mkdir -p "$USER_DATA_DIR"

echo "Starting Chrome with CDP on port $CDP_PORT..."
echo "Profile directory: $USER_DATA_DIR"

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port="$CDP_PORT" \
  --user-data-dir="$USER_DATA_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  "$@"
