#!/bin/sh
mkdir -p /app/data/paperclip/instances/default/logs
chown -R node:node /app/data/paperclip
exec runuser -p -u node -- "$@"