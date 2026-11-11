#!/bin/zsh
set -euo pipefail
cd "${0:A:h}"
./build.sh
./check-components.sh
output_dir="${1:-$PWD/dist}"
mkdir -p "$output_dir"
staging_dir=$(mktemp -d "${TMPDIR:-/tmp}/stageink-dmg.XXXXXX")
trap 'rm -rf "$staging_dir"' EXIT
cp -R StageInk.app "$staging_dir/StageInk.app"
ln -s /Applications "$staging_dir/Applications"
cat > "$staging_dir/Read me.txt" <<'TXT'
StageInk 0.2 preview for macOS 13 or later

Drag StageInk to Applications, eject this disk and open StageInk from Applications.

Start in Interact mode. Use Start drawing or Command+Option+D. Escape returns to Interact when the drawing window or controls has focus. Command+Q quits.

Settings are saved in your Library/Application Support/StageInk folder.

This preview is ad-hoc signed and has not been notarized. Mac security may require permission to open it. Source and build instructions are in the GitHub repository.

Apple Silicon execution and component checks were verified. Intel execution, physical desktop drawing, click-through, global shortcuts and full-screen presentations need hands-on verification.
TXT
hdiutil create -ov -volname StageInk -srcfolder "$staging_dir" -format UDZO "$output_dir/StageInk-macOS.dmg"
hdiutil verify "$output_dir/StageInk-macOS.dmg"
