#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run pack:mac
# Installation remains an explicit Finder operation; never delete a user's app.
echo 'Built successfully. Open dist-app/mac-arm64 (Apple Silicon) or dist-app/mac (Intel).'
echo 'Drag Alive Set Manager.app into Applications, then follow the first-run setup.'
