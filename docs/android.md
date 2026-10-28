# DangerRoom for Android · β-002

Android 9 or newer, on phones and tablets. The app connects to any HTTPS DangerRoom instance running β-002 or later. Download the signed **DangerRoom.apk** from [DangerRoom's β-002 release](https://github.com/erickolb/DangerRoom/releases/tag/v0.1.0-beta.2), alongside `SHA256SUMS.txt`. Installing it does not authorize a device. While the repository is private, downloading requires GitHub access to DangerRoom.

## Install and connect

1. Download the APK, open it, and allow your browser to install apps if Android asks. Install updates over the existing app.
2. Ask the DangerRoom administrator to issue a credential for this device. Each installation should have its own credential.
3. Open DangerRoom. Its mask startup screen leads to connection settings on first use.
4. Enter the instance hostname (for example `dangerroom.chateaulore.net`), device ID, and secret. A custom HTTPS port is supported. Paths, HTTP, and credentials embedded in the address are rejected.
5. Tap **Save and test connection**. The app verifies that the credential is enabled before saving it in Android Keystore-encrypted storage. Backups and device transfers exclude credentials. Reinstalling requires provisioning again.

The menu contains Want List, Comic Lookup by Camera, Text search on Metron, My Collection, Cover Slideshow, and Reading Log. **Menu → Instance and device settings** changes servers or credentials. No Metron credentials are entered on the phone. Existing browser controls are shared in an authenticated Android WebView, with native startup, configuration, capture and recognition. The instance must be reachable to browse or save; this release does not provide offline inventory.

## Provision or revoke a device

On astralplane, from the deployed checkout:

```sh
sudo docker compose exec dangerroom node scripts/devices.mjs add "Eric's tablet"
sudo docker compose exec dangerroom node scripts/devices.mjs list
sudo docker compose exec dangerroom node scripts/devices.mjs revoke DEVICE_ID
```

The add command prints the device ID and a random secret **once**. Deliver these privately. The server stores a SHA-256 hash, never the original secret. Revocation applies to every subsequent API and cover request, including the regular web API when called with those credentials. Already displayed/downloaded images cannot be recalled. Credentials identify approved installations; they do not use hardware fingerprinting or Android IDs, and a copied secret can impersonate that device. Revoke it and issue another if exposed.

For a local non-Docker checkout, use `pnpm devices add "Phone"`, `pnpm devices list`, and `pnpm devices revoke DEVICE_ID` with Node 24. Browser access uses a separate administrator key and expiring HttpOnly session; see [container updates](updating.md). Mobile routes always require an enabled device even when trusted-network browser access is enabled.

## Camera lookup

Take a straight-on photograph with the comic filling the frame; avoid reflections and bags when possible. Bundled ML Kit models recognize Latin text and barcodes on the phone. Review and correct the suggested series, issue number, and UPC before searching.

DangerRoom tries the barcode first, then falls back to the supplied title if it finds no issues. It retrieves the first five candidate issues' covers per page, retaining each exact Metron variant key and UPC. Narrow by issue number or use the next-page button for further candidates. Artwork comparison downloads at most 24 candidate covers to the phone and ranks their approximate color layout against the photo. Barcode matches take priority. **This is an advisory shortlist, not guaranteed visual identification**: stylized logos, text-free covers, cropping, perspective, reflections and missing Metron art can prevent a useful match. OCR may select the wrong text. UPC readers can omit the five-digit supplement that distinguishes printings/variants. There is no global reverse-image search or background Metron crawl.

Confirm the issue/year and cover visually. Tap its tile to open the existing cover picker with that exact variant preselected. Ownership and wants save the selected edition; reading and ratings remain issue-wide. Nothing is added merely by taking a photo or opening results. The photo is not uploaded to DangerRoom or an image/AI service; temporary capture files are removed when used/cancelled. Candidate images and standard ML Kit SDK behavior require their normal network access; no external AI key is required. Recognition uses [Google's bundled barcode](https://developers.google.com/ml-kit/vision/barcode-scanning/android) and [text models](https://developers.google.com/ml-kit/vision/text-recognition/v2/android).

## Cover Slideshow

Only owned editions with saved artwork are eligible; duplicate copies of the same edition appear once. Different owned variants remain separate. The slideshow does not query Metron or require a League of Comic Geeks account.

Settings mirror RoguesGallery: maximum covers (default 1000), random or collection-order selection, remembered selection, random display order, 3–600 seconds per cover (default 15), cross-fades or cuts, and individual cover exclusions. Remembered selections retain eligible covers and fill gaps when the collection changes. Preferences are stored separately per instance. Use previous/next, Play/Pause, Exclude cover, Full screen, and Settings. Failed images are skipped for the current session. Playback pauses when the app leaves the foreground. The screen stays awake only during playback. Images load as needed; this first version does not retain an offline cover cache.

## Build and signing

Use JDK 21 or newer and Android SDK 36:

```sh
cd android
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

For a distributable release, set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`, then run `./gradlew :app:assembleRelease`. All four must be provided together. Without these variables, release output is unsigned and must not be published. Preserve the signing key and passwords outside Git so future APKs can update the same application. Debug APKs use a different key and cannot update a release installation. CI verifies debug builds; published APKs are signed separately. Keep `applicationId=net.chateaulore.dangerroom`, retain the signing key, and increment versionCode for every future published Android build.

Published version: **0.1.0-beta.2 / β-002**, Android version code **1**. APKs, checksums, release notes, and installation guides belong in **erickolb/DangerRoom**. This release uses tag `v0.1.0-beta.2`. Keep this guide and the README aligned with each published Android build; do not publish DangerRoom artifacts in QuartermasterIntake.
