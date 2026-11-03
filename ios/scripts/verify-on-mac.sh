#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -d ../public ]]; then mkdir -p HardlightTests/Fixtures; cp -R ../public/. HardlightTests/Fixtures/; fi
trap 'status=$?; if (( status != 0 )); then tail -60 build.log test.log 2>/dev/null || true; fi' EXIT
bash scripts/build-ipa.sh > build.log 2>&1
DEVICE="${SIMULATOR_ID:-$(xcrun simctl list devices available -j | python3 -c 'import json,sys; d=json.load(sys.stdin); print(next(x["udid"] for k,v in d["devices"].items() if "iOS" in k for x in v if "iPhone" in x["name"]))')}"
# Xcode 16.4 / iOS 18.5 locates the Swift WebKit overlay incorrectly when
# deploying below iOS 18.4. Keep the device deployment target at iOS 17.
# Apple workaround: https://developer.apple.com/forums/thread/785964
RUNTIME_ID="$(xcrun simctl list devices -j | python3 -c 'import json,sys; device=sys.argv[1]; print(next(k for k,v in json.load(sys.stdin)["devices"].items() if any(x["udid"] == device for x in v)))' "$DEVICE")"
RUNTIME="$(xcrun simctl list runtimes -j | python3 -c 'import json,sys; print(next(x["bundlePath"] for x in json.load(sys.stdin)["runtimes"] if x["identifier"] == sys.argv[1]))' "$RUNTIME_ID")"
OVERLAY="$RUNTIME/Contents/Resources/RuntimeRoot/System/Cryptexes/OS/usr/lib/swift/libswiftWebKit.dylib"
if [[ -f "$OVERLAY" ]]; then
  mkdir -p build/tests/Build/Products/Debug-iphonesimulator
  ln -sf "$OVERLAY" build/tests/Build/Products/Debug-iphonesimulator/libswiftWebKit.dylib
fi
xcodebuild -project Hardlight.xcodeproj -scheme Hardlight -configuration Debug \
  -destination "platform=iOS Simulator,id=$DEVICE" \
  -parallel-testing-enabled NO -derivedDataPath build/tests CODE_SIGNING_ALLOWED=NO test > test.log 2>&1
echo 'Device IPA and simulator tests succeeded.'

