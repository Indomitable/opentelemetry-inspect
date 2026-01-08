#!/bin/bash

# Exit on error
set -e

VERSION=$1

if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Usage: $0 <major.minor.revision>"
    exit 1
fi

echo "Releasing version $VERSION..."

# Root directory of the project
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
APP_DIR="$ROOT_DIR/app"

# Update package.json
if [[ -f "$APP_DIR/package.json" ]]; then
    # Use sed to update version. Works on both GNU and BSD sed.
    sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$APP_DIR/package.json"
    rm "$APP_DIR/package.json.bak"
    echo "Updated app/package.json"
else
    echo "Warning: app/package.json not found"
fi

# Update tauri.conf.json
TAURI_CONF="$APP_DIR/src-tauri/tauri.conf.json"
if [[ -f "$TAURI_CONF" ]]; then
    sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$TAURI_CONF"
    rm "$TAURI_CONF.bak"
    echo "Updated src-tauri/tauri.conf.json"
else
    echo "Warning: $TAURI_CONF not found"
fi

# Update Cargo.toml
CARGO_TOML="$APP_DIR/src-tauri/Cargo.toml"
if [[ -f "$CARGO_TOML" ]]; then
    # Only replace the first occurrence of version = "..."
    sed -i.bak "0,/version = \".*\"/s/version = \".*\"/version = \"$VERSION\"/" "$CARGO_TOML"
    rm "$CARGO_TOML.bak"
    echo "Updated src-tauri/Cargo.toml"
    cd "$APP_DIR/src-tauri" && cargo update
else
    echo "Warning: $CARGO_TOML not found"
fi

# Update Summary.vue
SUMMARY_VUE="$APP_DIR/src/views/Summary.vue"
if [[ -f "$SUMMARY_VUE" ]]; then
    sed -i.bak "s/<span class=\"version-tag\">v.*<\/span>/<span class=\"version-tag\">v$VERSION<\/span>/" "$SUMMARY_VUE"
    rm "$SUMMARY_VUE.bak"
    echo "Updated app/src/views/Summary.vue"
else
    echo "Warning: $SUMMARY_VUE not found"
fi

# Update metainfo.xml
METAINFO_FILE="$ROOT_DIR/dist/linux/eu.venfen.opentelemetry-inspect.metainfo.xml"
if [[ -f "$METAINFO_FILE" ]]; then
    RELEASE_DATE=$(date +%Y-%m-%d)
    # Insert new release after <releases> tag
    sed -i.bak "/<releases>/a \    <release version=\"$VERSION\" date=\"$RELEASE_DATE\" />" "$METAINFO_FILE"
    rm "$METAINFO_FILE.bak"
    echo "Updated dist/linux/eu.venfen.opentelemetry-inspect.metainfo.xml"
else
    echo "Warning: $METAINFO_FILE not found"
fi

# Git operations
cd "$ROOT_DIR"
git add app/package.json app/src-tauri/tauri.conf.json app/src-tauri/Cargo.toml app/src-tauri/Cargo.lock app/src/views/Summary.vue dist/linux/eu.venfen.opentelemetry-inspect.metainfo.xml

echo "Changes to be committed:"
git diff --cached

read -p "Do you want to proceed with the commit? (y/n) " -n 1 -r
echo    # move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Commit aborted. Files are still staged."
    exit 1
fi

git commit -m "chore: release v$VERSION"
git tag "v$VERSION"

echo "Successfully released version $VERSION and created tag v$VERSION"

read -p "Do you want to push the commit and tag to origin? (y/n) " -n 1 -r
echo    # move to a new line
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin HEAD
    git push origin "v$VERSION"
    echo "Successfully pushed to origin"
else
    echo "Push cancelled"
fi
