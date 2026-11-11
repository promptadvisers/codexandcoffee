#!/bin/zsh
set -euo pipefail
cd "${0:A:h}"
mkdir -p build StageInk.app/Contents/MacOS StageInk.app/Contents/Resources
for arch in arm64 x86_64; do
  xcrun swiftc -swift-version 5 -target "$arch-apple-macos13.0" Sources/StageInk.swift -o "build/StageInk-$arch" -framework AppKit -framework Carbon
done
lipo -create build/StageInk-arm64 build/StageInk-x86_64 -output StageInk.app/Contents/MacOS/StageInk
cat > StageInk.app/Contents/Info.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>org.promptadvisers.stageink</string><key>CFBundleName</key><string>StageInk</string><key>CFBundleExecutable</key><string>StageInk</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>0.2.0</string><key>CFBundleVersion</key><string>2</string><key>NSHighResolutionCapable</key><true/><key>LSMinimumSystemVersion</key><string>13.0</string></dict></plist>
PLIST
./build-fixture.sh
cp -R 'Practice Surface.app' StageInk.app/Contents/Resources/
codesign --force --deep --sign - StageInk.app
codesign --verify --deep --strict StageInk.app
