#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -p "require('$ROOT_DIR/package.json').version")

echo "Packaging Ivy extension v${VERSION}..."

# Sync version to extension package.json
node -e "
  const fs = require('fs');
  const path = '$ROOT_DIR/packages/extension/package.json';
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  pkg.version = '$VERSION';
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

# Build
pnpm --filter @ivy/extension build

# Zip
mkdir -p "$ROOT_DIR/dist"
cd "$ROOT_DIR/packages/extension/.output"
zip -r "$ROOT_DIR/dist/ivy-extension-${VERSION}.zip" chrome-mv3/

echo "Created dist/ivy-extension-${VERSION}.zip"
