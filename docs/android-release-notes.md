**Hardlight 1.0.2** adds local caching for Cover Slideshow.

- Cache downloaded artwork for six months (180 days), with a **300 MB limit enabled by default**.
- Adjust the limit in slideshow settings, or disable it to cache as much as the device permits.
- When full, retain existing cached covers and continue displaying uncached covers from the network without saving them. Lowering the limit removes the least recently used files.
- **Flush cache** deletes downloaded slideshow artwork immediately.
- At slideshow initialization, remove cached files outside the eligible playlist in the background, including black-bagged and no-longer-owned covers.
- Cache failures or insufficient storage do not stop playback. Android may reclaim cache storage. Inventory still requires server access.

**Update DangerRoom to β-028 and install Hardlight 1.0.2.** The container serves cache settings and 180-day image cache headers; the APK implements local disk storage. Use the existing backup/rebuild procedure. No schema migration is needed.

Android 9 or newer; **versionCode 15**; display name **Danger Room**; application ID **net.chateaulore.hardlight**. Install over your signed Hardlight app to retain credentials and slideshow preferences.

Includes signed **DangerRoom.apk**, **SHA256SUMS.txt**, and **SIGNING-CERTIFICATE.txt**. Obtainium can track this normal release.

[Server update instructions](https://github.com/erickolb/DangerRoom/blob/main/docs/updating.md) · [Android installation](https://github.com/erickolb/DangerRoom/blob/main/docs/android.md) · [Download website](https://erickolb.github.io/DangerRoom/hardlight/)
