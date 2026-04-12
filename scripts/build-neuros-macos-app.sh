#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/neuros-macos"
APP_PACKAGE_JSON="$APP_DIR/package.json"
EXECUTABLE_NAME="NeurOSDesktopApp"
CONFIGURATION="${CONFIGURATION:-release}"
OUTPUT_DIR="${OUTPUT_DIR:-$APP_DIR/dist}"
DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
BRAND_RESOURCES_DIR="$APP_DIR/Sources/NeurOSDesktopFeatures/Resources/Brand"

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
APP_ICON_SOURCE="$BRAND_RESOURCES_DIR/gn_isotipo_transp_4000.png"
APP_ICON_NAME="${PRODUCT_NAME}.icns"

pushd "$APP_DIR" >/dev/null
DEVELOPER_DIR="$DEVELOPER_DIR" swift build -c "$CONFIGURATION" --product "$EXECUTABLE_NAME" >/dev/null
BIN_PATH="$(DEVELOPER_DIR="$DEVELOPER_DIR" swift build -c "$CONFIGURATION" --show-bin-path)"
popd >/dev/null

generate_app_icon() {
  local source_png="$1"
  local icon_path="$2"
  local iconset_dir
  iconset_dir="$(mktemp -d "$OUTPUT_DIR/${PRODUCT_NAME}.XXXXXX.iconset")"

  cleanup_iconset() {
    rm -rf "$iconset_dir"
  }

  trap cleanup_iconset RETURN

  local base_sizes=(16 32 128 256 512)
  for size in "${base_sizes[@]}"; do
    local double_size=$((size * 2))
    sips -z "$size" "$size" "$source_png" --out "$iconset_dir/icon_${size}x${size}.png" >/dev/null
    sips -z "$double_size" "$double_size" "$source_png" --out "$iconset_dir/icon_${size}x${size}@2x.png" >/dev/null
  done

  iconutil -c icns "$iconset_dir" -o "$icon_path"
}

rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources"

cp "$BIN_PATH/$EXECUTABLE_NAME" "$APP_BUNDLE/Contents/MacOS/$EXECUTABLE_NAME"
chmod +x "$APP_BUNDLE/Contents/MacOS/$EXECUTABLE_NAME"

while IFS= read -r -d '' resource_bundle; do
  ditto "$resource_bundle" "$APP_BUNDLE/Contents/Resources/$(basename "$resource_bundle")"
done < <(find "$BIN_PATH" -maxdepth 1 -name '*.bundle' -print0)

if [ -f "$APP_ICON_SOURCE" ]; then
  generate_app_icon "$APP_ICON_SOURCE" "$APP_BUNDLE/Contents/Resources/$APP_ICON_NAME"
fi

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
  <key>CFBundleIconFile</key>
  <string>${PRODUCT_NAME}</string>
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
