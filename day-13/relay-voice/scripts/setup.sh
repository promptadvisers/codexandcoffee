#!/bin/bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
[[ "$(uname -s)" == Darwin ]] || { echo 'Use the Windows source-build instructions in README.md.' >&2; exit 1; }
for tool in node npm python3 swiftc codesign; do
  command -v "$tool" >/dev/null || { echo "Missing prerequisite: $tool. See README.md." >&2; exit 1; }
done
python3 -m venv "$root/.venv"
"$root/.venv/bin/python" -m pip install pyinstaller==6.22.3 certifi==2026.10.23
npm --prefix "$root/app/electron" ci
"$root/.venv/bin/python" "$root/scripts/build-backend.py"
"$root/app/build-electron.sh"
echo 'Built Relay Voice. Open the app and add your own Gemini key in Settings & setup.'
