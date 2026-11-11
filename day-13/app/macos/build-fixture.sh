#!/bin/zsh
set -euo pipefail
cd "${0:A:h}"
mkdir -p build 'Practice Surface.app/Contents/MacOS'
for arch in arm64 x86_64; do
  xcrun swiftc -swift-version 5 -target "$arch-apple-macos13.0" Sources/PracticeSurface.swift -o "build/PracticeSurface-$arch" -framework AppKit
done
lipo -create build/PracticeSurface-arm64 build/PracticeSurface-x86_64 -output 'Practice Surface.app/Contents/MacOS/PracticeSurface' 
cat > 'Practice Surface.app/Contents/Info.plist' <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>local.day13.practice-surface</string><key>CFBundleName</key><string>Practice Surface</string><key>CFBundleExecutable</key><string>PracticeSurface</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>1.0</string><key>NSHighResolutionCapable</key><true/></dict></plist>
PLIST
codesign --force --sign - 'Practice Surface.app'
