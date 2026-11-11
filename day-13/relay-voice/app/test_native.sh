#!/bin/zsh
set -euo pipefail
app_dir=${0:A:h}
test_binary=$(mktemp /tmp/relay-native-test.XXXXXX)
trap 'rm -f "$test_binary"' EXIT
swiftc "$app_dir/native/IntegrationPolicy.swift" "$app_dir/test_native.swift" -o "$test_binary"
"$test_binary"
swiftc "$app_dir/native/HoldState.swift" "$app_dir/test_native_hold.swift" -o "$test_binary"
"$test_binary"
