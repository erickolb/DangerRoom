Hardlight **0.1.2** introduces experimental artwork-only Scan Cover. Crop the photographed cover, then search Metron with an ImageHash-compatible pHash calculated on the phone. Only the fingerprint leaves the phone.

OCR and barcodes remain bundled and inactive by default. **Scan Cover → Scan settings → Enable OCR and barcode lookup** restores the previous flow. The checkbox starts unchecked and persists after Save.

Metron requires an exact hash match against the main issue cover. Glare, perspective, crop differences, and variants can prevent a match. Confirm issue and cover before saving.

Requires server **β-022 or later**. Android 9 or newer; versionCode **10**; app ID **net.chateaulore.hardlight**. Install over existing signed Hardlight.

Includes signed DangerRoom.apk, SHA256SUMS.txt, and SIGNING-CERTIFICATE.txt. Normal release supported by Obtainium.

[Server update instructions](https://github.com/erickolb/DangerRoom/blob/main/docs/updating.md) · [Android setup](https://github.com/erickolb/DangerRoom/blob/main/docs/android.md)
