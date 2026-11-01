**Hardlight 1.0.1** improves Cover Slideshow recovery during container restarts and connection interruptions.

- Failed covers stay in rotation until three strikes. If a previously failed cover loads successfully, all remaining covers' strikes reset to zero. Healthy covers with no strikes do not reset other covers' failures.
- Failed loads wait 3 seconds before trying the next cover. Stalled image loading or decoding times out after 20 seconds. The last visible cover stays on screen during failures.
- An empty playlist shows a spinner and waits 10 minutes before rebuilding from the full eligible collection with fresh strike counts. Failed initialization repeats at 10-minute intervals. Covers removed after three strikes return on reinitialization.

**Update DangerRoom to β-027 before using the new slideshow behavior.** Playback code is served by the container; existing APKs also receive the fix after exiting and reopening the slideshow once after the server update. Updating only the APK does not update the server.

Android 9 or newer; **versionCode 14**; display name **Danger Room**; application ID **net.chateaulore.hardlight**. Install over signed Hardlight 1.0.0 to retain device credentials and slideshow preferences. No database migration is required for this update.

Includes signed **DangerRoom.apk**, **SHA256SUMS.txt**, and **SIGNING-CERTIFICATE.txt**. Obtainium can track this normal release.

[Server update instructions](https://github.com/erickolb/DangerRoom/blob/main/docs/updating.md) · [Android installation](https://github.com/erickolb/DangerRoom/blob/main/docs/android.md) · [Download website](https://erickolb.github.io/DangerRoom/)
