# DangerRoom for Android · β-004

Android 9 or newer, on phones and tablets. The app connects to any HTTPS DangerRoom instance running β-004 or later. Use the [download website](https://erickolb.github.io/DangerRoom/) or download the signed **DangerRoom.apk** from [DangerRoom's β-004 release](https://github.com/erickolb/DangerRoom/releases/tag/v0.1.0-beta.4), alongside `SHA256SUMS.txt`. The repository and downloads are public; installing the app does not authorize a device.

## Install and connect

1. Download the APK, open it, and allow your browser to install apps if Android asks. Install updates over the existing app.
2. Ask the DangerRoom administrator to issue a credential for this device. Each installation should have its own credential.
3. Open DangerRoom. Its mask startup screen leads to connection settings on first use.
4. Enter the instance hostname (for example `dangerroom.chateaulore.net`), device ID, and secret. A custom HTTPS port is supported. Paths, HTTP, and credentials embedded in the address are rejected.
5. Tap **Save and test connection**. The app verifies that the credential is enabled before saving it in Android Keystore-encrypted storage. Backups and device transfers exclude credentials. Reinstalling requires provisioning again.

The menu contains Want List, Comic Lookup by Camera, Text search on Metron, My Collection, Cover Slideshow, and Reading Log. **Menu → Instance and device settings** changes servers or credentials. No Metron credentials are entered on the phone. Existing browser controls are shared in an authenticated Android WebView, with native startup, configuration, capture and recognition. The instance must be reachable to browse or save; this release does not provide offline inventory.

## Device approval

After updating and starting the server, follow [Device token management](devices.md) for the commands to issue, list, revoke, and replace device credentials, including astralplane's HTTPS Compose override and source-only installations. Enter the returned `deviceId` and `token` into Android's **Device ID** and **Device secret** fields. Mobile routes always require an enabled device. Browser access requires no key by default; optional browser sign-in is independent.

## Camera lookup

Take a straight-on photograph with the comic filling the frame; avoid reflections and bags when possible. Bundled ML Kit models recognize Latin text and barcodes on the phone. Review and correct the suggested series, issue number, and UPC before searching.

DangerRoom tries the barcode first, then falls back to the supplied title if it finds no issues. It retrieves the first five candidate issues' covers per page, retaining each exact Metron variant key and UPC. Narrow by issue number or use the next-page button for further candidates. Artwork comparison downloads at most 24 candidate covers to the phone and ranks their approximate color layout against the photo. Barcode matches take priority. **This is an advisory shortlist, not guaranteed visual identification**: stylized logos, text-free covers, cropping, perspective, reflections and missing Metron art can prevent a useful match. OCR may select the wrong text. UPC readers can omit the five-digit supplement that distinguishes printings/variants. There is no global reverse-image search or background Metron crawl.

Confirm the issue/year and cover visually. Tap its tile to open the existing cover picker with that exact variant preselected. Ownership and wants save the selected edition; reading and ratings remain issue-wide. Nothing is added merely by taking a photo or opening results. The photo is not uploaded to DangerRoom or an image/AI service; temporary capture files are removed when used/cancelled. Candidate images and standard ML Kit SDK behavior require their normal network access; no external AI key is required. Recognition uses [Google's bundled barcode](https://developers.google.com/ml-kit/vision/barcode-scanning/android) and [text models](https://developers.google.com/ml-kit/vision/text-recognition/v2/android).

## Cover Slideshow

Only owned editions with saved artwork are eligible; duplicate copies of the same edition appear once. Different owned variants remain separate. The slideshow does not query Metron or require a League of Comic Geeks account.

The slideshow uses the full owned inventory with no maximum or remembered subset. Settings contain only random display order, 3–600 seconds per cover (default 15), and cross-fades or cuts. Timing and playback preferences are stored separately per instance.

Manage black bags from the collection listing. In the Android app, toggle the fourth **Ø** control on My Collection tiles to add or remove a black bag. This control is not shown in the browser web app. This placeholder will be replaced with an icon later. Status is saved on the server for the exact cover: all duplicate copies share it, while other variants remain independent. Ownership, wants, reading history, and ratings are unaffected. The saved state applies across devices when they next load the collection or slideshow. Earlier device-local exclusions migrate to server black bags when that device next opens its slideshow.

Play enters full screen automatically and keeps the screen awake. Controls and the caption fade away; tap the image to reveal previous/next, Pause, and Settings. Pausing or opening Settings leaves full screen. Playback pauses when the app leaves the foreground. Failed images are skipped for the current session. Images load as needed; this version does not retain an offline cover cache.

## Build and signing

Use JDK 21 or newer and Android SDK 36:

```sh
cd android
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

For a distributable release, set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`, then run `./gradlew :app:assembleRelease`. All four must be provided together. Without these variables, release output is unsigned and must not be published. Preserve the signing key and passwords outside Git so future APKs can update the same application. Debug APKs use a different key and cannot update a release installation. CI verifies debug builds; published APKs are signed separately. Keep `applicationId=net.chateaulore.dangerroom`, retain the signing key, and increment versionCode for every future published Android build.

Published version: **0.1.0-beta.4 / β-004**, Android version code **2**. APKs, checksums, release notes, and installation guides belong in **erickolb/DangerRoom**. This release uses tag `v0.1.0-beta.4`. Keep this guide and the README aligned with each published Android build; do not publish DangerRoom artifacts in QuartermasterIntake.
