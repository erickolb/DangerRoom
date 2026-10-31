Hardlight is the Android client for the DangerRoom web app. Its installed display name is **Danger Room**; its application ID is **net.chateaulore.hardlight**.

This first Hardlight release installs separately from the older `net.chateaulore.dangerroom` client and can coexist with it. Configure the instance hostname and server-issued device ID/secret in the new app. The old app and server collection are not changed. This APK uses the signing key configured by the repository owner in GitHub Actions; future Hardlight releases must retain that key and app ID.

Download **DangerRoom.apk** and check **SHA256SUMS.txt**. **SIGNING-CERTIFICATE.txt** contains public certificate metadata for verifying the signer. Android 9 or newer; versionCode 7.

Includes full comic barcode capture with positional OCR recovery for printed five-digit supplements, exact-cover Add/Want/Read controls from an updated server, and the existing collection, Want List, reading log, search, and full-screen cover slideshow.

For Obtainium, use this GitHub repository as the source and enable prerelease updates while releases are labeled beta. Track the new Hardlight application ID. Subsequent signed Hardlight APKs install as updates over this release.

[Android installation and configuration](https://github.com/erickolb/DangerRoom/blob/main/docs/android.md) · [Server update instructions](https://github.com/erickolb/DangerRoom/blob/main/docs/updating.md)
