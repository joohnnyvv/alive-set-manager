#!/bin/bash
set -e

echo "🔨 Building and packaging Alive Set Manager..."
npm run pack:mac

# Find built .app bundle regardless of architecture (mac-arm64, mac-x64, mac)
APP_PATH=$(find dist-app -name "Alive Set Manager.app" -type d -maxdepth 2 | head -n 1)

if [ -z "$APP_PATH" ]; then
  echo "❌ Error: Could not find 'Alive Set Manager.app' in dist-app directory."
  exit 1
fi

DEST_PATH="/Applications/Alive Set Manager.app"

echo "📦 Found application bundle at: $APP_PATH"
echo "🚀 Copying to /Applications..."

if [ -d "$DEST_PATH" ]; then
  echo "⚠️ Removing existing version at $DEST_PATH..."
  rm -rf "$DEST_PATH"
fi

cp -R "$APP_PATH" "/Applications/"

echo "✅ Alive Set Manager has been successfully installed to /Applications!"
