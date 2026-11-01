**Hardlight 1.0.0** is the first major release of the DangerRoom Android companion.

The menu contains **Want List, My Collection, Search Metron, Cover Slideshow, and Reading Log**. Text-based Metron search, exact variant selection, collection tracking, personal ratings, reading history, and slideshow settings remain available.

Experimental camera cover search has been removed entirely: no OCR, barcode capture, perspective correction, image hashing, scan settings, or scan uploads. Camera and recognition SDKs are no longer bundled.

**Update DangerRoom to β-025 or later before installing this APK.** The server removes scan lookup/retention endpoints and its export utility. Schema 7 deletes retained diagnostic scan images and hashes while preserving collection data and saved provider artwork.

Android 9 or newer; **versionCode 13**; display name **Danger Room**; application ID **net.chateaulore.hardlight**. Install over signed Hardlight 0.1.4 to retain credentials and slideshow preferences. Obsolete scan settings and the app-owned camera file are cleared.

Includes signed **DangerRoom.apk**, **SHA256SUMS.txt**, and **SIGNING-CERTIFICATE.txt**. Obtainium can track this normal release.

[Server update instructions](https://github.com/erickolb/DangerRoom/blob/main/docs/updating.md) · [Android installation](https://github.com/erickolb/DangerRoom/blob/main/docs/android.md) · [Download website](https://erickolb.github.io/DangerRoom/)
