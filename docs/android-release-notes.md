# Hardlight 1.2.0-beta.3 for Android

Android beta prerelease · version code 19 · application ID `net.chateaulore.hardlight`.

- Tap **Next** in Android’s scanner to compute the cover hash and open Metron results immediately.
- Remove the extra **Review cover** confirmation and the separate DangerRoom bounding-box/rotation controls. Use the scanner’s own crop, rotate, and corner-adjustment interface before Next.
- Discarding or canceling the scan returns to setup without searching. If processing fails, recapture from setup. Confirmed-image memory and temporary files are released after hashing.
- Keep the styled setup screen, hash-distance slider 10–20 (default 16), and standard Metron result cards and actions. Only the hash is sent; photographs stay on-device.
- Android-only update. DangerRoom remains **1.1.1**, with minimum supported server **1.1.0**. No server container update is needed for beta 3. Server 1.1.1 supplies the Image Search menu icon.
- Stable Android and iOS remain at 1.1.0. All three feature TODOs stay unchecked until stable approval.

Obtainium users with prereleases enabled can update over beta 2. The package ID and signing key are unchanged; code 19 updates code 18 without reinstalling. Google Play services and its first-use scanner download are required.

Artifacts: `DangerRoom.apk`, `SHA256SUMS.txt`, `SIGNING-CERTIFICATE.txt`. Verify `sha256sum -c SHA256SUMS.txt` on Linux or `Get-FileHash .\DangerRoom.apk -Algorithm SHA256` in PowerShell.
