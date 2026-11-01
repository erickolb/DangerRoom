# Compare captured covers with Metron

Hardlight 0.1.4 and DangerRoom β-024 retain the latest **ten submitted camera scans per instance**, shared across devices. Pressing **Find matching covers** saves the scan before querying Metron, so unsuccessful searches are retained. Cancelled or retaken previews are not uploaded. Both the default perspective-corrected mode and optional OCR/barcode mode save a diagnostic entry.

Each entry contains the exact bitmap used for pHash as a **lossless PNG**, its 16-digit client-generated hash, sequential scan ID, server receipt time in UTC, capture UUID, dimensions, PNG SHA-256, capture mode, algorithm name, and Hardlight version. PNG encoding does not change the bitmap pixels; the server records the supplied perceptual hash without recomputing it. Default-mode images are already perspective-corrected; the scanner does not supply the raw pre-correction photograph to DangerRoom.

The image and metadata live together in the `scan_captures` SQLite table inside `DATA_DIR/dangerroom.sqlite`, including when collection artwork uses S3. One transaction saves each pair and removes older entries beyond ten. Retries with the same capture UUID reuse the existing record; retrying does not reorder retained scans. Removed scan IDs return 404. Uploads are limited to 25 MiB and 4096 pixels per side. No inventory, Want List, rating, or reading records are changed.

Hardlight displays **Retained scan #ID** on the result screen even when no match is found. An upload failure is shown on the preview with retry available; the app does not proceed with an unrecorded lookup. Update the server before installing Hardlight 0.1.4. Reverse proxies must permit a 25 MiB `image/png` request to `/mobile/api/scan-captures`; for Nginx, use `client_max_body_size 25m;` in the applicable server/location and reload after validating its configuration. No additional environment variables are required.

## Retrieve from the server

Run from the deployed DangerRoom checkout on astralplane. Keep its existing Compose override selection as documented in [container updates](updating.md).

List the latest captures without exposing image bytes:

```sh
sudo docker compose exec -T dangerroom node scripts/scan-captures.mjs list
```

Export a consistent snapshot to a new directory, then copy it out of the container:

```sh
scan_export="scan-review-$(date +%Y%m%d-%H%M%S)"
sudo docker compose exec -T dangerroom node scripts/scan-captures.mjs export "/tmp/$scan_export"
sudo docker compose cp "dangerroom:/tmp/$scan_export" "./$scan_export"
```

The export contains `manifest.json` and up to ten `scan-ID-HASH.png` files. A new output directory is required; existing exports are never overwritten. Exported snapshots are separate from rolling retention and remain until removed by the operator; the container's `/tmp` copy disappears when the container is recreated. SQLite backups follow their own retention policy.

For a source installation:

```sh
node --env-file-if-exists=.env scripts/scan-captures.mjs list
node --env-file-if-exists=.env scripts/scan-captures.mjs export "./scan-review-$(date +%Y%m%d-%H%M%S)"
```

Authenticated tools can also use `GET /api/scan-captures` and `GET /api/scan-captures/ID/image`. Both require an enabled device or administrator browser session even when ordinary browser access is public. The `/mobile/` prefix always requires device credentials. Responses use `Cache-Control: no-store`. Images are not published on the download website and are not sent to Metron.

## Comparison workflow

After scanning, tell us the retained scan ID and link to the exact Metron issue/variant. We can export its PNG, recompute pHash with Python ImageHash, confirm the recorded hash, and compare it with the relevant Metron artwork. Count differing bits (Hamming distance) and inspect the images for glare, framing, orientation, and remaining perspective differences. A similar image can still fail Metron's exact-hash filter.

### First known case: Absolute Martian Manhunter #6, Amy Reeder variant

Verified against Metron's API on 2026-11-01:

- [Absolute Martian Manhunter (2025) #6, issue 150997](https://metron.cloud/issue/absolute-martian-manhunter-2025-6/).
- Selected edition: **Cover B Amy Reeder Variant**, UPC **76194138788800621**.
- [Variant artwork](https://static.metron.cloud/media/variants/2025/08/01/3912da16a0fe4530bf5a9656d12f9dbd.jpg).
- Metron's exact UPC search returned zero issues for that variant UPC, although it is present in the issue's nested variants.
- The main issue's UPC is **76194138788800611** and its main-cover hash is **b092c7215f3f8f24**. The cover-hash filter checks the main issue cover; it does not discover this variant by its artwork's own hash.

This case establishes a catalog-filter limitation independently of photo quality. Compare the retained photograph with the Amy Reeder artwork, not the issue's main cover. Do not assign this identity to every retained scan; ask which scan depicts which edition.
