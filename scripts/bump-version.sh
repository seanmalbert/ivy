#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Usage: ./scripts/bump-version.sh [major|minor|patch]
# Default: patch
BUMP_TYPE="${1:-patch}"

CURRENT=$(node -p "require('$ROOT_DIR/package.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: $0 [major|minor|patch]"; exit 1 ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

# Update root package.json
node -e "
  const fs = require('fs');
  const path = '$ROOT_DIR/package.json';
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  pkg.version = '${NEW_VERSION}';
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

# Update extension package.json
node -e "
  const fs = require('fs');
  const path = '$ROOT_DIR/packages/extension/package.json';
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  pkg.version = '${NEW_VERSION}';
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

echo "Bumped ${CURRENT} → ${NEW_VERSION}"
