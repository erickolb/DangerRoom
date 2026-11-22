# Hardlight 1.2.0 for iOS — Build 3

iOS 17+ · app ID `net.chateaulore.hardlight`.

Read the [cover image search walkthrough](https://erickolb.github.io/DangerRoom/hardlight/cover-image-search/). Choose distance 10–20 (default 14), capture one cover, adjust its corners/rotation in the platform scanner, and confirm to search. Photographs stay on device; only the perceptual hash is sent. Standard Metron results retain collection, Want List, and read controls. Missing series types enrich after display, stopping at quota exhaustion without automatic retries on server 1.1.2.

iOS confirms with **Save** in Apple's document scanner. Scan one cover at a time; cancellation returns to setup. The native minimum is DangerRoom 1.1.0; use server 1.1.2 for progressive enrichment. Version checking stays behind the loading screen; an incompatible instance blocks use with Retry and settings. Existing Keychain credentials and local slideshow caching are preserved.

Install the IPA through LiveContainer + SideStore, retaining the same app identity/settings. Packages are ad-hoc signed and must be re-signed for the device. Artifacts at publication: DangerRoom.ipa and its SHA-256 checksum. Validation includes device IPA signature verification and seven simulator tests. Physical-device camera and sideload acceptance were not performed.
