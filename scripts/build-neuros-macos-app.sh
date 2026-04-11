#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/neuros-macos"
APP_PACKAGE_JSON="$APP_DIR/package.json"
EXECUTABLE_NAME="NeurOSDesktopApp"
CONFIGURATION="${CONFIGURATION:-release}"
OUTPUT_DIR="${OUTPUT_DIR:-$APP_DIR/dist}"
DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

read_package_field() {
  local field="$1"

  node --input-type=module -e '
    import fs from "node:fs";

    const [packageJsonPath, fieldName] = process.argv.slice(1);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const value = packageJson[fieldName];

    if (value === undefined) {
      process.exit(1);
    }

    process.stdout.write(String(value));
  ' "$APP_PACKAGE_JSON" "$field"
}

PRODUCT_NAME="$(read_package_field productName)"
BUNDLE_IDENTIFIER="$(read_package_field bundleIdentifier)"
VERSION="$(read_package_field version)"
APP_BUNDLE="$OUTPUT_DIR/$PRODUCT_NAME.app"

pushd "$APP_DIR" >/dev/null
DEVELOPER_DIR="$DEVELOPER_DIR" swift build -c "$CONFIGURATION" --product "$EXECUTABLE_NAME" >/dev/null
BIN_PATH="$(DEVELOPER_DIR="$DEVELOPER_DIR" swift build -c "$CONFIGURATION" --show-bin-path)"
popd >/dev/null

rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources"

cp "$BIN_PATH/$EXECUTABLE_NAME" "$APP_BUNDLE/Contents/MacOS/$EXECUTABLE_NAME"
chmod +x "$APP_BUNDLE/Contents/MacOS/$EXECUTABLE_NAME"

cat > "$APP_BUNDLE/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>${PRODUCT_NAME}</string>
  <key>CFBundleExecutable</key>
  <string>${EXECUTABLE_NAME}</string>
  <key>CFBundleIdentifier</key>
  <string>${BUNDLE_IDENTIFIER}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${PRODUCT_NAME}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${VERSION}</string>
  <key>CFBundleVersion</key>
  <string>${VERSION}</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.business</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF

codesign --force --deep --sign - "$APP_BUNDLE" >/dev/null

printf '%s\n' "$APP_BUNDLE"
