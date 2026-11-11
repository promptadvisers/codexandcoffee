#!/bin/zsh
set -euo pipefail
cd "${0:A:h}"
mkdir -p component-checks
python3 - <<'PY'
from pathlib import Path
source = Path('Sources/StageInk.swift').read_text()
source = source.rsplit('let delegate = StageInkDelegate()', 1)[0]
Path('component-checks/CombinedChecks.swift').write_text(source + Path('Sources/ComponentChecks.swift').read_text())
PY
xcrun swiftc -swift-version 5 component-checks/CombinedChecks.swift -o component-checks/StageInkChecks -framework AppKit -framework Carbon
./component-checks/StageInkChecks "$PWD/component-checks"
