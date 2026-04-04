#!/usr/bin/env bash
set -euo pipefail
cd /Volumes/JS-DEV/paperclip
export PATH="$HOME/.asdf/installs/nodejs/22.21.1/bin:$PATH"
export SHARP_IGNORE_GLOBAL_LIBVIPS=1
exec corepack pnpm dev:once
