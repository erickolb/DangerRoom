# Danger Room (Hardlight) for Android · 1.0.1

Android 9 or newer, on phones and tablets. The app connects to any HTTPS DangerRoom instance running β-027 or later. Use the [download website](https://erickolb.github.io/DangerRoom/hardlight/) or download the signed **DangerRoom.apk** from [Hardlight's 1.0.1 release](https://github.com/erickolb/DangerRoom/releases/tag/v1.0.1), alongside `SHA256SUMS.txt`. The repository and downloads are public; installing the app does not authorize a device.

## Hardlight identity

**Hardlight** is the nickname for the DangerRoom Android client. Its installed display name is **Danger Room** and its application ID is `net.chateaulore.hardlight`. The website and server remain DangerRoom.

The first Hardlight build is a separate Android installation from the older `net.chateaulore.dangerroom` client. Both can coexist; the new app needs its own instance/device configuration. Nothing is removed from the old app or server. Use **Install with Obtainium** on the download website to add `erickolb/DangerRoom` as the release source. Track the `net.chateaulore.hardlight` app ID. Version 1.0.1 is a normal release and does not require prerelease updates. Install Obtainium first if the link does not open. Continue using the same signing key and app ID for subsequent updates.

The currently published APK uses the Hardlight app ID and the repository owner’s GitHub Actions signing key. Install 1.0.1 over an existing signed Hardlight installation to retain its local configuration; Android versionCode is 14. The server continues to use its own version (currently β-027).

The launcher icon matches the loading screen’s red palette, thin dark circle outline, and lower-right dark-red shadow. Adaptive foreground artwork uses a transparent 1080×1080 canvas with a centered 480px badge, a 40px diagonal shadow offset, and a 3.75px outline. Legacy launcher resources cover mdpi through xxxhdpi.

## Install and connect

1. Download the APK, open it, and allow your browser to install apps if Android asks. Install updates over the existing app.
2. Ask the DangerRoom administrator to issue a credential for this device. Each installation should have its own credential.
3. Open **Danger Room** (Hardlight). Its startup screen shows only the centered outlined mask with a matching dark-red shadow on a red background, then leads to connection settings on first use.
4. Enter the instance hostname (for example `comics.example.net`), device ID, and secret. A custom HTTPS port is supported. Paths, HTTP, and credentials embedded in the address are rejected.
5. Tap **Save and test connection**. The app verifies that the credential is enabled before saving it in Android Keystore-encrypted storage. Backups and device transfers exclude credentials. Reinstalling requires provisioning again.

The menu contains Want List, My Collection, Search Metron, Cover Slideshow, and Reading Log. **Menu → Instance and device settings** changes servers or credentials. No Metron credentials are entered on the phone. Existing browser controls are shared in an authenticated Android WebView, with native startup and configuration. The instance must be reachable to browse or save; this release does not provide offline inventory.

## Device approval

After updating and starting the server, follow [Device token management](devices.md) for the commands to issue, list, revoke, and replace device credentials, including astralplane's HTTPS Compose override and source-only installations. Enter the returned `deviceId` and `token` into Android's **Device ID** and **Device secret** fields. Mobile routes always require an enabled device. Browser access requires no key by default; optional browser sign-in is independent.

## Hardlight 1.0.1

Hardlight 1.0.1 provides text-based Metron search with exact cover selection, My Collection, Want List, ratings, Reading Log, and Cover Slideshow. Camera cover search, OCR, barcode capture, perspective correction, scan settings, and scan diagnostics have been removed. No camera or recognition SDK is bundled.

Update DangerRoom to **β-027 or later** first so the server-provided menu has the same five sections. Upgrading the server removes previously retained diagnostic scan images and hashes; collection artwork and inventory records are preserved. The Android update clears obsolete scan preferences and its old app-owned camera file while retaining connection credentials and slideshow settings.

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


For a distributable release, set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`, then run `./gradlew :app:assembleRelease`. All four must be provided together. Without these variables, release output is unsigned and must not be published. Preserve the signing key and passwords outside Git so future APKs can update the same application. Debug APKs use a different key and cannot update a release installation. CI verifies debug builds. The manually dispatched **Publish signed Android release** workflow validates and signs release APKs using repository Actions secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. It decodes the keystore into a temporary file, supplies `ANDROID_KEYSTORE_PATH`, verifies the signed APK, and publishes the APK, checksum, and public certificate metadata. Choose a tag matching the Android `versionName`, such as `v1.0.1`; release notes come from `docs/android-release-notes.md`. For Hardlight builds keep `applicationId=net.chateaulore.hardlight`, retain the signing key, and increment versionCode for every future published Android build.

Published version: **1.0.1**, Android version code **13**. APKs, checksums, release notes, and installation guides belong in **erickolb/DangerRoom**. This release uses tag `v1.0.1`. Keep this guide and the README aligned with each published Android build; do not publish DangerRoom artifacts in QuartermasterIntake.
