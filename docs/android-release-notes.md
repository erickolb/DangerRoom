Hardlight **0.1.4** retains the last ten submitted cover scans on your DangerRoom instance for image-matching diagnostics.

Before searching, the app uploads a lossless PNG of the exact bitmap used for pHash, its 16-digit hash, capture mode, UUID, and app version. The server adds dimensions, receipt time, a checksum, and a retained scan ID. Failed Metron matches are retained. Cancelled/retaken previews are not uploaded. Both perspective-corrected and optional OCR/barcode modes are supported; OCR remains off by default.

The result screen shows **Retained scan #ID**. Scans are stored together in SQLite, shared across devices, with only the newest ten retained. Authentication is required to retrieve photographs. A server CLI exports the PNGs and a manifest for comparison. Only the fingerprint or legacy search terms are sent to Metron.

**Update DangerRoom to β-024 before installing this APK.** Reverse proxies must allow PNG uploads up to 25 MiB. An upload failure stays on the preview for retry instead of silently searching without a retained image.

Android 9 or newer; versionCode **12**; app ID **net.chateaulore.hardlight**. Install over signed Hardlight 0.1.3. Signed APK, SHA256SUMS.txt, and SIGNING-CERTIFICATE.txt included; supported by Obtainium.

[Server updates](https://github.com/erickolb/DangerRoom/blob/main/docs/updating.md) · [Scan diagnostics and export](https://github.com/erickolb/DangerRoom/blob/main/docs/scan-diagnostics.md)
