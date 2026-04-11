#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/neuros-macos"
APP_PACKAGE_JSON="$APP_DIR/package.json"
PREFERRED_INSTALL_DIR="${INSTALL_DIR:-/Applications}"
OPEN_AFTER_INSTALL="${OPEN_AFTER_INSTALL:-1}"

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
APP_BUNDLE="$("$ROOT_DIR/scripts/build-neuros-macos-app.sh")"

if [ ! -w "$PREFERRED_INSTALL_DIR" ]; then
  PREFERRED_INSTALL_DIR="$HOME/Applications"
fi

mkdir -p "$PREFERRED_INSTALL_DIR"

INSTALL_PATH="$PREFERRED_INSTALL_DIR/$PRODUCT_NAME.app"
rm -rf "$INSTALL_PATH"
ditto "$APP_BUNDLE" "$INSTALL_PATH"

if [ "$OPEN_AFTER_INSTALL" = "1" ]; then
  open "$INSTALL_PATH"
fi

printf '%s\n' "$INSTALL_PATH"
