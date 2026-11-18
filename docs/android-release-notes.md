# Hardlight 1.2.0-beta.2 for Android

Android beta prerelease · version code 18 · application ID `net.chateaulore.hardlight`.

- Requires DangerRoom server **1.1.0**; update to **1.1.1** for the new Image Search menu icon. Update your server first using [container update instructions](https://github.com/erickolb/DangerRoom/blob/main/docs/updating.md). Older servers show a polite blocking error with Retry and instance settings.
- Restyles the capture setup, review, and editing screens with the DangerRoom header, serif titles, wine panels, coral primary buttons, warm text, and quieter secondary actions.
- Uses the supplied black Image Search icon by Muhammad Adam / Noun Project (CC BY 3.0), with only its corner text removed and credits retained.
- Adds **Image Cover Search** to the top-level menu: hash-distance slider 10–20, default 16; Capture Image; CPHTest-style document scanner with perspective/corner and rotation editing; review, edit bounding box/rotation, and Search.
- Computes ImageHash-compatible perceptual hashes locally and searches Metron main covers through the instance. Photographs never upload. Results use the standard Metron cards, filters, pagination, and actions.
- Server 1.1.0 gives lit/unlit read buttons the same dialog. Mark as read defaults on; journal recording defaults off; selecting a date enables recording; marking unread offers Preserve journal entries, default on.
- Stable Android and iOS remain at 1.1.0. iOS features and compatibility checking follow stable approval. All three related TODOs remain unchecked during beta.

Install with Obtainium using the Android beta link in the website footer, or install this signed APK over the existing release. Google Play services and the scanner’s first-use download are required. The app ID and signing certificate are unchanged. Future beta/stable builds use higher version codes.

Artifacts: `DangerRoom.apk`, `SHA256SUMS.txt`, `SIGNING-CERTIFICATE.txt`. Verify `sha256sum -c SHA256SUMS.txt` on Linux or `Get-FileHash .\DangerRoom.apk -Algorithm SHA256` in PowerShell.
