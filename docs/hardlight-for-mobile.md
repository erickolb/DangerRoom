# Hardlight for Mobile

Hardlight is the Android and iOS companion for your DangerRoom instance. Its installed name is **Danger Room**, and both platforms use application ID `net.chateaulore.hardlight`. The clients share server screens and the authenticated mobile API; features are mirrored unless explicitly limited to one platform.

## Requirements

Hardlight **1.3.0** supports series subscriptions and Image Cover Search on both platforms, with default distance 14 (range 10–20) and on-device hashing. The minimum-server check stays behind startup branding. iOS uses Apple's document scanner: capture one cover, adjust corners/rotation, and tap **Save** to search directly. Android uses **Next**. See the [walkthrough](https://erickolb.github.io/DangerRoom/hardlight/cover-image-search/). Minimum server: **1.2.0** for subscription endpoints.

| | Android | iOS |
| --- | --- | --- |
| Devices | Phones and tablets, Android 9 or later | iPhone and iPad, iOS 17 or later |
| Published client | 1.3.0, version code 24 | 1.3.0, build 4 |
| Server | DangerRoom 1.2.0 or later over HTTPS | DangerRoom 1.2.0 or later over HTTPS |
| Distribution | GitHub APK; Obtainium updates | GitHub IPA; iOS sideloading |

Server and client versions are independent. Public downloads do not authorize access to an instance. Neither platform is distributed through commercial app stores. Start with the [Hardlight download page](https://erickolb.github.io/DangerRoom/hardlight/).

## Android beta channel

The website footer’s **Android beta (Obtainium)** link imports the same app ID and repository with prereleases enabled and Android releases selected. It updates the existing app using the same signing key. Stable **1.3.0** includes the subscriptions feature tested in Android beta 1.3.0-beta.1. Code **24** upgrades beta code **23** using the same signing identity, without reinstalling. Android and iOS stable clients both require DangerRoom **1.2.0** and include the same [subscription views and controls](subscriptions.md). Update the [server container](updating.md) first if it is older. The initial compatibility check remains behind the branded loading screen.

The footer's beta setup remains available for future prereleases. Future stable version codes must exceed all preceding beta codes.

## Cover image search

Open **Image Cover Search** from the menu. Select hash distance 10–20 (default 14), then **Capture Image**. Adjust corners and rotation in the platform scanner, then confirm to search immediately. Canceling returns to setup. Results use regular Metron cards, filters, pagination, and actions. Android requires Google Play services and its first-use scanner download; iOS uses Apple VisionKit. Captures stay on device; only a perceptual hash is sent through the server to Metron.

Server 1.1.2 displays matches immediately and fetches missing series types afterward. Enrichment stops at quota exhaustion, lookup errors, or navigation without automatic resumption. Successful lookups are cached for later queries. Unknown-type matches remain visible while badges and filters update. Incompatible servers show a blocking message with required versions, Retry, and instance settings.

## Android

Download the signed **DangerRoom.apk** from the [Android 1.3.0 release](https://github.com/erickolb/DangerRoom/releases/tag/v1.3.0), alongside `SHA256SUMS.txt`. Open the APK and allow installation from your browser if prompted. Install updates over the existing signed Hardlight app to retain local configuration.

For automatic update tracking, install Obtainium, then use **Install with Obtainium** on the download page to add `erickolb/DangerRoom` as the release source. Track application ID `net.chateaulore.hardlight`. Version 1.3.0 is a normal release and does not require prerelease updates.

The older `net.chateaulore.dangerroom` client is a separate installation. It can coexist with Hardlight, but Hardlight needs its own instance and device configuration. Official updates retain the Hardlight app ID and signing key. Debug builds use a different key and cannot update an official release installation.

### iOS

Download [DangerRoom.ipa](https://github.com/erickolb/DangerRoom/releases/download/ios-v1.3.0-build4/DangerRoom.ipa) and its [SHA-256 checksum](https://github.com/erickolb/DangerRoom/releases/download/ios-v1.3.0-build4/DangerRoom.ipa.sha256), or use the [iOS download page](https://erickolb.github.io/DangerRoom/hardlight/#ios).

Set up [SideStore](https://sidestore.io/), add `https://erickolb.github.io/DangerRoom/sidestore.json` as a source, and install Hardlight. You can also import the IPA manually. For the LiveContainer route, follow the [LiveContainer + SideStore installation guide](https://livecontainer.github.io/docs/installation/lc_sidestore). The package is ad-hoc signed and verified during the build; SideStore must re-sign it for your Apple account and device before direct installation. Enable Developer Mode if prompted and refresh through SideStore before its signing period expires. Hardlight has no extensions and uses one app ID.

Install updates over the existing app using the same Apple account and identity. Changing identity or deleting the app can require provisioning again.

## Connect to DangerRoom

1. Ask the administrator for a separate device ID and secret for this installation using [Mobile Device Token Management](mobile-device-token-management.md). The server must be running before issuing credentials.
2. Open **Danger Room**. First launch leads from the mask startup screen to connection settings.
3. Enter your instance hostname (for example `comics.example.net`), device ID, and 64-character secret. Custom HTTPS ports are supported. HTTP, paths, and credentials embedded in the address are rejected.
4. Tap **Save and test connection**. The client verifies that the credential is enabled before saving it.

**Menu → Instance and device settings** changes servers or credentials. Enter the returned `deviceId` as **Device ID** and `token` as **Device secret**. No Metron token belongs on the phone or tablet.

Android uses Keystore-encrypted credential storage; iOS uses the unlocked, device-only Keychain. Credentials are excluded from backups and transfers and are never exposed to the web page. Reinstalling requires provisioning again. Both clients refuse redirects and keep credentials separate from artwork-host requests. Administrators can revoke a lost or exposed credential without affecting browser access or other devices.

## Use Hardlight

The menu contains Want List, My Collection, Search Metron, UPC Mode, Cover Slideshow, Reading Log, and Image Cover Search. Collection, exact cover selection, ratings, and reading history use the shared site's behavior; see [Advanced usage notes](advanced-usage-notes.md).

The instance must be reachable to browse or save. Cached slideshow artwork does not provide offline inventory. Cover scanning runs locally through Google ML Kit on Android and Apple VisionKit on iOS; no advertising or analytics SDK is bundled. After a server update, the main menu's **Reload** button fetches the latest server code without exiting Hardlight; native client changes require installing a client update.

### UPC Mode

Open **UPC Mode** immediately after Search Metron, or use its barcode toggle. External keyboard/HID scanners can send STX (0x02 / Ctrl+B), digits, and Enter. Scan regardless of field focus; a new scan closes dialogs without undoing completed saves. More than 12 digits searches exactly; 12 or fewer searches the UPC prefix. Confirm the highlighted/preselected exact cover before saving. See [scanner setup and behavior](upc-mode.md).

### Cover Slideshow

Only owned covers with saved artwork are eligible. Duplicate copies of one cover appear once; different owned variants remain separate. Playback uses the full eligible inventory with no maximum or remembered subset and makes no Metron requests.

Use the **black-bag icon** on mobile collection tiles or comic details to exclude an exact cover from the slideshow. Browser collection tiles omit this control, but browser details include it. Black bags are saved on the server and shared across devices when they next load the collection or slideshow. Duplicate copies share the exclusion; other variants remain independent. Ownership, wants, ratings, and reading history are unaffected. Older device-local exclusions migrate when that device next opens playback.

Open **Slideshow settings** from the main menu. Settings include random order, 3–600 seconds per cover (default 15), cross-fades or cuts, controls inactivity timeout (default 10 seconds, minimum 3), and title display duration. A title duration of 0 disables titles; matching the cover duration keeps them visible throughout. Timing and playback preferences are stored separately per instance.

**Cover Slideshow** launches full-screen and keeps the screen awake while playing. Tap the image to reveal previous/next, Pause/Play, and **Exit**. Pausing retains full-screen view; Exit returns to the menu. Playback pauses when the app leaves the foreground. Failed images are skipped for the current session, with recovery attempts when artwork or the server becomes available again.

Artwork is cached for 180 days. The default limit is 300 MB; disable the limit to cache as much as the device permits. A full cache retains existing covers and displays uncached images over the network without saving them. Lowering the limit removes least recently used files. **Flush cache** deletes downloaded artwork. Playlist initialization prunes cached images outside the current playlist. Settings and cover caches are isolated by instance/device, and either operating system may reclaim cache storage.

## Build and publish

Native build and signing procedures differ by platform. Publish signed artifacts, checksums, and release notes in `erickolb/DangerRoom`, with separate Android and iOS titles and tags. Keep this guide, README, website downloads, and the SideStore feed aligned with published builds. Do not publish DangerRoom artifacts in QuartermasterIntake.

### Android build and signing

Use JDK 21 or newer and Android SDK 36:

```sh
cd android
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

For a distributable release, set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`, then run `./gradlew :app:assembleRelease`. All four must be provided together. Without these variables, release output is unsigned and must not be published. Preserve the signing key and passwords outside Git so future APKs can update the same application. Debug APKs use a different key and cannot update a release installation. CI verifies debug builds. The manually dispatched **Publish signed Android release** workflow validates and signs release APKs using repository Actions secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. It decodes the keystore into a temporary file, supplies `ANDROID_KEYSTORE_PATH`, verifies the signed APK, and publishes the APK, checksum, and public certificate metadata. Choose a tag matching the Android `versionName`, such as `v1.3.0`; release notes come from `docs/android-release-notes.md`. For Hardlight builds keep `applicationId=net.chateaulore.hardlight`, retain the signing key, and increment versionCode for every future published Android build.

Stable version: **1.3.0**, Android version code **24**, tag `v1.3.0`; iOS build **4**, tag `ios-v1.3.0-build4`. APKs, checksums, release notes, and installation guides belong in **erickolb/DangerRoom**. Keep this guide and the README aligned with each published Android build; do not publish DangerRoom artifacts in QuartermasterIntake.

The launcher icon matches the loading screen's red palette, thin dark circle outline, and lower-right dark-red shadow. Adaptive foreground artwork uses a transparent 1080×1080 canvas with a centered 480px badge, a 40px diagonal shadow offset, and a 3.75px outline. Legacy launcher resources cover mdpi through xxxhdpi.

### iOS build and signing

Open `ios/Hardlight.xcodeproj` with Xcode 16 or later. There are no package dependencies. On a Mac:

```sh
cd ios
bash scripts/verify-on-mac.sh
```

From Windows, `./ios/scripts/build-on-mac.ps1 -BuildNumber 4 -Test` transfers source to an isolated build directory on `erickolb@barovia.chateaulore.net` using SSH host key alias `barovia.local`. It runs simulator tests, builds an arm64 device app, verifies an ad-hoc signature, and downloads `ios/dist/DangerRoom.ipa`.

Maintainer builds run on **barovia.chateaulore.net**. Build the full device IPA with `bash ios/scripts/build-ipa.sh`, verify its signature/checksum, and publish the IPA, checksum and release notes in `erickolb/DangerRoom`, leaving Android as GitHub Latest. Hosted iOS workflows are manual and are not used for the Barovia release path. Increment the Xcode build number for every published IPA. Release tags use `ios-vVERSION-buildNUMBER`; titles use `Danger Room (Hardlight) vVERSION for iOS`. Android keeps its existing tags and adds `for Android` to titles. Keep the SideStore feed, website and guides aligned with published assets.

Simulator tests cover request boundaries and cache behavior. Physical-device SideStore installation and manual feature checks are still required for real-device acceptance.

## Release notes

See [Android release notes](android-release-notes.md) and [iOS release notes](ios-release-notes.md) for the current platform releases.
