#!/bin/zsh
set -euo pipefail
app_dir=${0:A:h}
# Electron copies this directory to Contents/Resources/native (outside app.asar).
out=${1:-"$app_dir/dist/helper"}
mkdir -p "$out"
swiftc -O -target "$(uname -m)-apple-macos13.0" -framework AppKit -framework AVFoundation -framework ApplicationServices -framework Carbon \
  "$app_dir/native/HoldState.swift" \
  "$app_dir/native/HelperBridge.swift" "$app_dir/native/ElectronHelper.swift" \
  -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker "$app_dir/native/Helper-Info.plist" \
  -o "$out/relay-voice-helper"
cp "$app_dir/backend.py" "$out/backend.py"
codesign --force --sign - "$out/relay-voice-helper"
print -r -- "$out/relay-voice-helper"
