# Danger Room (Hardlight) for Android · 0.1.4

Android 9 or newer, on phones and tablets. The app connects to any HTTPS DangerRoom instance running β-024 or later. Use the [download website](https://erickolb.github.io/DangerRoom/) or download the signed **DangerRoom.apk** from [Hardlight's 0.1.4 release](https://github.com/erickolb/DangerRoom/releases/tag/v0.1.4), alongside `SHA256SUMS.txt`. The repository and downloads are public; installing the app does not authorize a device.

## Hardlight identity

**Hardlight** is the nickname for the DangerRoom Android client. Its installed display name is **Danger Room** and its application ID is `net.chateaulore.hardlight`. The website and server remain DangerRoom.

The first Hardlight build is a separate Android installation from the older `net.chateaulore.dangerroom` client. Both can coexist; the new app needs its own instance/device configuration. Nothing is removed from the old app or server. Use **Install with Obtainium** on the download website to add `erickolb/DangerRoom` as the release source. Track the `net.chateaulore.hardlight` app ID. Version 0.1.4 is a normal release and does not require prerelease updates. Install Obtainium first if the link does not open. Continue using the same signing key and app ID for subsequent updates.

The currently published APK uses the Hardlight app ID and the repository owner’s GitHub Actions signing key. Install 0.1.4 over an existing signed Hardlight installation to retain its local configuration; Android versionCode is 12. The server continues to use its own version (currently β-024).

The launcher icon matches the loading screen’s red palette, thin dark circle outline, and lower-right dark-red shadow. Adaptive foreground artwork uses a transparent 1080×1080 canvas with a centered 480px badge, a 40px diagonal shadow offset, and a 3.75px outline. Legacy launcher resources cover mdpi through xxxhdpi.

## Install and connect

1. Download the APK, open it, and allow your browser to install apps if Android asks. Install updates over the existing app.
2. Ask the DangerRoom administrator to issue a credential for this device. Each installation should have its own credential.
3. Open **Danger Room** (Hardlight). Its startup screen shows only the centered outlined mask with a matching dark-red shadow on a red background, then leads to connection settings on first use.
4. Enter the instance hostname (for example `dangerroom.chateaulore.net`), device ID, and secret. A custom HTTPS port is supported. Paths, HTTP, and credentials embedded in the address are rejected.
5. Tap **Save and test connection**. The app verifies that the credential is enabled before saving it in Android Keystore-encrypted storage. Backups and device transfers exclude credentials. Reinstalling requires provisioning again.

The menu contains Want List, My Collection, Search Metron, Scan Cover, Cover Slideshow, and Reading Log. **Menu → Instance and device settings** changes servers or credentials. No Metron credentials are entered on the phone. Existing browser controls are shared in an authenticated Android WebView, with native startup, configuration, capture and recognition. The instance must be reachable to browse or save; this release does not provide offline inventory.

## Device approval

After updating and starting the server, follow [Device token management](devices.md) for the commands to issue, list, revoke, and replace device credentials, including astralplane's HTTPS Compose override and source-only installations. Enter the returned `deviceId` and `token` into Android's **Device ID** and **Device secret** fields. Mobile routes always require an enabled device. Browser access requires no key by default; optional browser sign-in is independent.

## Camera lookup

Capture the cover with the same ML Kit document scanner used in Lumiere. Place its four corner posts precisely at the cover’s corners, using the scanner’s magnified view for accurate placement. Finish the scanner to correct perspective, then inspect the rectangular **Review straightened cover** preview and tap **Find matching covers**. Use Retake photo to repeat capture and corner adjustment. Cancel returns without searching or saving. Hardlight calculates ImageHash-compatible pHash on the phone and sends that fingerprint and a lossless PNG of the same image to DangerRoom. The server retains the last ten submitted scans for comparison, including failed matches. Metron receives only the fingerprint. DangerRoom queries Metron by cover_hash only, using existing caching and request pacing. Requires server **β-024 or later**.

Metron currently uses exact hash equality against the main issue cover. Camera differences and variant artwork may produce no match. Results include the matched issue’s variants for visual confirmation; nothing is saved until you use its controls.

**Scan Cover → Scan settings** opens a modal with **Enable OCR and barcode lookup**, unchecked by default. Save persists the setting on this installation. Enabling it restores the previous on-device ML Kit text/barcode recognition, ZXing supplement decoding, editable searches, and advisory artwork ranking. Its submitted image and pHash are also retained for comparison. It replaces the fingerprint lookup flow; there is no automatic fallback. Disable it to return to artwork-only testing. Search Metron remains separately available from the menu.

OCR and barcode libraries remain bundled but are not invoked when the checkbox is off. The document scanner is a separate ML Kit component: base mode supports corner adjustment and perspective correction without document-cleanup filters. It requires Google Play services and downloads its scanning components on first use; allow connectivity for setup. An unavailable scanner shows Retry/Cancel, with Search Metron available from the menu. Images are processed on the device. See [Google’s document scanner documentation](https://developers.google.com/ml-kit/vision/doc-scanner/android). ZXing is Apache License 2.0. Cover artwork belongs to its rights holders.

See [scan diagnostics and server export](scan-diagnostics.md) for retained image/hash metadata, retrieval commands, and the first known variant comparison. A retained scan number appears above search results. Cancelled previews are not uploaded.

## Cover Slideshow

Only owned editions with saved artwork are eligible; duplicate copies of the same edition appear once. Different owned variants remain separate. The slideshow does not query Metron or require a League of Comic Geeks account.

The slideshow uses the full owned inventory with no maximum or remembered subset. Open **Slideshow settings** on the main menu beside **Instance and device settings**. Settings contain only random display order, 3–600 seconds per cover (default 15), and cross-fades or cuts. Timing and playback preferences are stored separately per instance.

In the Android app, toggle the fourth **black-bag icon** control on My Collection tiles to add or remove a black bag; browser collection tiles do not show it. Comic details in both Android and the browser include the same toggle immediately after the duplicate-copy button, with the tooltip **Black Bag - Hide from Cover Slideshow display**. The icon uses white outlines and transparent fill; its active button has a dark background. Status is saved on the server for the exact cover: all duplicate copies share it, while other variants remain independent. Ownership, wants, reading history, and ratings are unaffected. The saved state applies across devices when they next load the collection or slideshow. Earlier device-local exclusions migrate to server black bags when that device next opens its slideshow.

**Cover Slideshow** on the main menu opens directly into full-screen playback and keeps the screen awake while playing. Loading, empty, and error states also stay on the full-screen black background. Controls and the caption fade away; tap the image to reveal previous/next, Pause/Play, and **Exit**. Pausing keeps the full-screen view; Exit returns to the main menu. Slideshow settings are managed only from the main menu. Playback pauses when the app leaves the foreground. Failed images are skipped for the current session. Images load as needed; this version does not retain an offline cover cache.

## Build and signing

Use JDK 21 or newer and Android SDK 36:

```sh
cd android
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

**Instrumentation tests:** use an emulator or a dedicated test device. Do not run `connectedDebugAndroidTest` on a provisioned personal device: test-runner cleanup can uninstall the target app and remove its local credentials. Unit tests and lint do not install or remove the app.

For a distributable release, set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`, then run `./gradlew :app:assembleRelease`. All four must be provided together. Without these variables, release output is unsigned and must not be published. Preserve the signing key and passwords outside Git so future APKs can update the same application. Debug APKs use a different key and cannot update a release installation. CI verifies debug builds. The manually dispatched **Publish signed Android release** workflow validates and signs release APKs using repository Actions secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. It decodes the keystore into a temporary file, supplies `ANDROID_KEYSTORE_PATH`, verifies the signed APK, and publishes the APK, checksum, and public certificate metadata. Choose a tag matching the Android `versionName`, such as `v0.1.4`; release notes come from `docs/android-release-notes.md`. For Hardlight builds keep `applicationId=net.chateaulore.hardlight`, retain the signing key, and increment versionCode for every future published Android build.

Published version: **0.1.4**, Android version code **12**. APKs, checksums, release notes, and installation guides belong in **erickolb/DangerRoom**. This release uses tag `v0.1.4`. Keep this guide and the README aligned with each published Android build; do not publish DangerRoom artifacts in QuartermasterIntake.
