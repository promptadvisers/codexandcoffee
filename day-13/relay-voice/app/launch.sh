#!/bin/zsh
set -euo pipefail
app_dir=${0:A:h}
bundle="$app_dir/dist/electron/Relay Voice.app"
if [[ ! -x "$bundle/Contents/MacOS/Relay Voice" ]]; then
  "$app_dir/build-electron.sh"
fi
open "$bundle"
