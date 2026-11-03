#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -d ../public ]]; then mkdir -p HardlightTests/Fixtures; cp -R ../public/. HardlightTests/Fixtures/; fi
trap 'status=$?; if (( status != 0 )); then tail -60 build.log test.log 2>/dev/null || true; fi' EXIT
bash scripts/build-ipa.sh > build.log 2>&1
DEVICE="${SIMULATOR_ID:-$(xcrun simctl list devices available -j | python3 -c 'import json,sys; d=json.load(sys.stdin); print(next(x["udid"] for k,v in d["devices"].items() if "iOS" in k for x in v if "iPhone" in x["name"]))')}"
xcodebuild -project Hardlight.xcodeproj -scheme Hardlight -configuration Debug \
  -destination "platform=iOS Simulator,id=$DEVICE" \
  -derivedDataPath build/tests CODE_SIGNING_ALLOWED=NO test > test.log 2>&1
echo 'Device IPA and simulator tests succeeded.'

