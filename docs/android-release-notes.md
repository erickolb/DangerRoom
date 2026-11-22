# Hardlight 1.3.0-beta.1 for Android

Version code **23** · app ID `net.chateaulore.hardlight` · Android 9+.

Add **Subscriptions** to the top-level menu and the books button to comic cards. Subscribe or unsubscribe from an entire Metron series without a modal, independently of collection and Want List status. All visible comics in the series share the lit/unlit status.

The approved four-view interface uses equal-width compact icon-and-text buttons on one row: **List**, **Missing**, **This Week**, **Upcoming**. Release views use store dates and Sunday–Saturday weeks. Prefer the first wanted variant; otherwise use the standard cover. List thumbnails use the next release or latest past release and prefer wanted/collected variants. Pages appear progressively and remain usable if Metron's quota stops loading.

Includes server fixes for slideshow-hide controls on unowned comics, future Want List cover dates, narrow card action rows, and compact active Metron search headings. The supplied books icon is credited to [Study icons created by riajulislam - Flaticon](https://www.flaticon.com/free-icons/study).

**Requires DangerRoom server 1.2.0. Update the instance first.** The Android client now depends on subscription endpoints and supports authenticated PUT updates. The server check stays behind the branded loading screen; an older instance shows the blocking update message. Follow the [general server update guide](https://github.com/erickolb/DangerRoom/blob/main/docs/updating.md).

Install over the existing signed APK to keep settings. Code 23 upgrades stable code 22 without reinstalling. Artifacts: `DangerRoom.apk`, `SHA256SUMS.txt`, `SIGNING-CERTIFICATE.txt`. The website footer's **Android beta (Obtainium)** link tracks this prerelease; stable downloads remain 1.2.0. iOS remains unchanged during Android beta testing.

Validation: Android unit tests, lint, debug build, and signed release workflow; authenticated companion bridge browser checks covering subscription PUT, menu, synchronized controls, view layout, and legacy-client isolation; server tests. Physical-device acceptance is not claimed by these automated checks.
