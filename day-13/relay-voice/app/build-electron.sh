#!/bin/zsh
set -euo pipefail
app_dir=${0:A:h}
cd "$app_dir/electron"
if [[ ! -d node_modules/electron || ! -d node_modules/@electron/packager ]]; then
  npm ci
fi
npm test
npm run package
