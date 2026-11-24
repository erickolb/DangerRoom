# Hardlight 1.3.1 for Android

Version code **25** · Android 9+ · app ID `net.chateaulore.hardlight`.

Fix Bluetooth barcode-scanner connections and disconnections restarting Hardlight through the splash screen (issue #1). Both native activities now handle keyboard and navigation configuration changes without recreation.

With **DangerRoom server 1.2.1**, recover your active screen, searches and filters, completed UPC, selected cover, reading drafts, and scroll position after reload or process recreation. The slideshow returns to its selected eligible cover paused. Recovery fetches current server data and never replays submitted changes or partial scanner input. Android also preserves nonsecret connection-settings drafts and image-search distance; interrupted captures can be restarted safely.

The Android minimum server remains **1.2.0**; update to **1.2.1** for full shared recovery using the [general container update guide](https://github.com/erickolb/DangerRoom/blob/main/docs/updating.md). Existing **iOS 1.3.0 build 4** receives the shared web improvements through that server update; no iOS release accompanies this patch.

Install this signed APK over the existing app to retain credentials and caches. Code 25 upgrades stable code 24 and all previous beta codes. Obtainium prereleases are not required.

Artifacts: `DangerRoom.apk`, `SHA256SUMS.txt`, and `SIGNING-CERTIFICATE.txt`. See [recovery behavior and acceptance checks](https://github.com/erickolb/DangerRoom/blob/main/docs/state-recovery.md). Automated browser validation uses a mocked native bridge; physical scanner and iOS lifecycle acceptance remain device checks.
