# Danger Room (Hardlight) 1.0.2 for iOS · Build 1

Requires iOS 17 or newer on iPhone or iPad and DangerRoom β-029 or later. Distribution is through GitHub and sideloading only; there is no App Store release.

## Install

Download [DangerRoom.ipa](https://github.com/erickolb/DangerRoom/releases/download/ios-v1.0.2-build1/DangerRoom.ipa) and its [SHA-256 checksum](https://github.com/erickolb/DangerRoom/releases/download/ios-v1.0.2-build1/DangerRoom.ipa.sha256), or use the [Hardlight download page](https://erickolb.github.io/DangerRoom/hardlight/#ios). Set up [SideStore](https://sidestore.io/), add `https://erickolb.github.io/DangerRoom/sidestore.json` as a source, and install Hardlight. You can also import the IPA manually. The package is ad-hoc signed and verified during the build; SideStore must re-sign it for your Apple account and device before installation. Enable Developer Mode if prompted. Refresh through SideStore before its signing period expires. The app has no extensions and uses one app ID, `net.chateaulore.hardlight`.

Install updates over the existing app using the same Apple account and identity. Changing identity or deleting the app can require provisioning again. The installed name is **Danger Room**.

## Connect and use

Ask the administrator for a separate device ID and secret for this installation using [device management](devices.md). Enter your HTTPS hostname (custom HTTPS ports are supported), device ID, and 64-character secret. Tap **Save and test connection**. Paths, embedded credentials, and HTTP are rejected. Credentials are saved in the unlocked, device-only Keychain and never exposed to the web page. Redirects are refused. No Metron token belongs on the phone.

The shared client has Want List, My Collection, Search Metron, Cover Slideshow, and Reading Log, with exact variants, ratings and black bags. **Menu → Instance and device settings** changes the connection. Slideshow settings have random order, 3–600 seconds per cover, cross-fades/cuts, a default 300 MB cache limit, unlimited cache and Flush cache. Cached covers expire after 180 days; a full cache displays uncached images without saving them. Playlist initialization prunes unrelated files. Settings and cover caches are isolated by instance/device. Playback keeps the screen awake and pauses when the app leaves the foreground. iOS can reclaim cached artwork. Inventory still needs a live connection.

Android and iOS features must be mirrored unless a change is explicitly limited to one platform. Both use the same server screens and authenticated mobile API. No camera scanning or analytics SDK is included.

## Build and publish

Open `ios/Hardlight.xcodeproj` with Xcode 16 or later. There are no package dependencies. On a Mac:

```sh
cd ios
bash scripts/verify-on-mac.sh
```

From Windows, `./ios/scripts/build-on-mac.ps1 -Test` transfers source to an isolated build directory on `erickolb@barovia.chateaulore.net` using SSH host key alias `barovia.local`. It runs simulator tests, builds an arm64 device app, verifies an ad-hoc signature, and downloads `ios/dist/DangerRoom.ipa`.

The **Publish iOS release** workflow tests and builds the same package, publishes the IPA, checksum and release notes in `erickolb/DangerRoom`, and leaves Android as GitHub Latest. Increment the Xcode build number for every published IPA. Release tags use `ios-vVERSION-buildNUMBER`; titles use `Danger Room (Hardlight) vVERSION for iOS`. Android keeps its existing tags and adds `for Android` to titles. Keep the SideStore feed, website and guides aligned with published assets.

Simulator tests cover request boundaries and cache behavior. Physical-device SideStore installation and manual feature checks are still required for real-device acceptance.
