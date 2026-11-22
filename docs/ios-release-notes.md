# Hardlight 1.3.0 for iOS

Build **4** · iOS 17+ · app ID `net.chateaulore.hardlight`.

Follow a whole series with **Subscriptions**, independently of collection, reading status, and Want List entries. The books button toggles subscription immediately without a modal and lights up on every displayed comic in the same series.

Browse **List**, **Missing**, **This Week**, and **Upcoming** using the approved compact icon-and-text buttons, equally spaced across one row. Date views use store release dates and Sunday–Saturday weeks. Release cards prefer the first wanted variant; list thumbnails use the next release or latest past issue with wanted/collected variant preferences. Cached pages appear progressively and remain usable if Metron's quota stops further loading.

Includes the server's improved Want List dates, narrow comic action rows, compact active search headings, and slideshow-hide controls only on owned covers. The supplied books icon is credited to [Study icons created by riajulislam - Flaticon](https://www.flaticon.com/free-icons/study).

**Requires DangerRoom server 1.2.0** for subscription endpoints. Update older instances using the [general server update guide](https://github.com/erickolb/DangerRoom/blob/main/docs/updating.md). Initial checks stay behind the branded loading screen; outdated instances show the required versions and Retry/settings. Both stable clients provide subscriptions at feature parity.

Install the ad-hoc signed IPA through LiveContainer + SideStore, which re-signs it for your device. Keep the same app identity to retain settings. Artifacts: `DangerRoom.ipa` and `DangerRoom.ipa.sha256`.

Existing image cover search remains available: [walkthrough](https://erickolb.github.io/DangerRoom/hardlight/cover-image-search/). Photographs stay on device; only the perceptual hash is sent for matching. Stable downloads remain the default; the website's quiet Obtainium beta footer remains available for future testing.

Validation covers Android unit tests/lint/build, iOS simulator menu and authenticated subscription transport tests, server and companion browser checks, and artifact signatures/checksums. Physical-device iOS installation acceptance is not claimed by automated tests.
