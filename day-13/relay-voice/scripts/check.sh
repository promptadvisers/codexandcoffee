#!/bin/bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
python3 -m unittest discover -s "$root/app" -p test_backend.py
npm --prefix "$root/app/electron" test
"$root/app/test_native.sh"
"$root/app/build-helper.sh"
python3 "$root/app/test_native_helper.py"
