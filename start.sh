#!/bin/bash
# Paperclip 启动脚本

export PAPERCLIP_HOME=/tmp/paperclip-data
export SERVE_UI=true
export PAPERCLIP_MIGRATION_AUTO_APPLY=true

cd "$(dirname "$0")" && npx -y pnpm@9.15.4 dev
