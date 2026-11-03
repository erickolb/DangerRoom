#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
WORK="$(mktemp -d "$ROOT/build-ipa.XXXXXX")"
mkdir -p "$ROOT/dist" "$WORK/Payload"
DERIVED_DATA="${DERIVED_DATA_PATH:-$ROOT/build/iphoneos}"
xcodebuild -project Hardlight.xcodeproj -scheme Hardlight \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED_DATA" CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  ${BUILD_NUMBER:+CURRENT_PROJECT_VERSION=$BUILD_NUMBER} build
APP="$WORK/Payload/Hardlight.app"
ditto "$DERIVED_DATA/Build/Products/Release-iphoneos/Hardlight.app" "$APP"
while IFS= read -r -d '' framework; do
  codesign --force --sign - --timestamp=none "$framework"
done < <(find "$APP" -depth \( -name '*.framework' -o -name '*.dylib' \) -print0)
codesign --force --sign - --timestamp=none "$APP"
codesign --verify --deep --strict "$APP"
(cd "$WORK" && /usr/bin/zip -qry DangerRoom.ipa Payload)
mv "$WORK/DangerRoom.ipa" "$ROOT/dist/DangerRoom.ipa"
shasum -a 256 "$ROOT/dist/DangerRoom.ipa"
echo "Ready for SideStore: $ROOT/dist/DangerRoom.ipa"

