# Update a DangerRoom instance

Run from the original DangerRoom checkout; changing the Compose project/directory name can select a different named volume. These commands build from source; no registry login or prepublished image is required. Keep .env and the named data volume across updates.

The commands assume the checkout is at `~/DangerRoom`, the default location when cloning from your home directory. If yours is elsewhere, set `DANGERROOM_DIR` to its actual absolute path first. Do not type a placeholder such as `/path/to/DangerRoom` literally. The backup and update blocks below run in a subshell with `set -e`, so a failed directory change or command stops that block without closing your SSH session.

## Configure the instance address once

Keep your instance's address in the checkout's private `.env`, so the commands below work across updates and new shell sessions:

```sh
cd "${DANGERROOM_DIR:-$HOME/DangerRoom}" && vi .env
```

For an HTTPS reverse proxy, add your own URL (the following hostname is an example):

```dotenv
DANGERROOM_URL=https://comics.example.net
```

For the default local port mapping, use `DANGERROOM_URL=http://127.0.0.1:4340` instead. If you changed `DANGERROOM_PORT`, use the matching host port in the URL. Do not add `/api/health` to this base URL. `DANGERROOM_URL` records the address used to reach the instance; it does not configure DNS, the proxy, the listener, or `ALLOWED_HOSTS`. For HTTPS, separately include your hostname in `ALLOWED_HOSTS` and configure the proxy to route it to DangerRoom.

If you use a local `compose.https.yaml` override, also add this line to `.env`:

```dotenv
COMPOSE_FILE=compose.yaml:compose.https.yaml
```

Compose reads this setting from `.env` for every command below, including commands run with `sudo`. This persists the override selection without relying on shell environment variables that `sudo` may discard. Omit it for installations using only `compose.yaml`. Retain any other override files your deployment needs in that colon-separated list.

## Back up before updating

Run in a shell on your server:

```sh
(
set -e
cd "${DANGERROOM_DIR:-$HOME/DangerRoom}"
test -f compose.yaml
test -f .env
git status --short
git rev-parse HEAD > previous-revision.txt
sudo docker image tag dangerroom:local dangerroom:rollback
sudo docker compose stop dangerroom
mkdir -p backups
chmod 700 backups
backup_stamp=$(date +%Y%m%d-%H%M%S)
cp .env "backups/environment-$backup_stamp.env"
chmod 600 "backups/environment-$backup_stamp.env"
if [ -f compose.https.yaml ]; then cp compose.https.yaml "backups/compose.https-$backup_stamp.yaml"; fi
sudo docker compose run --rm --no-deps --user root --cap-add DAC_OVERRIDE --entrypoint tar -v "$PWD/backups:/backups" dangerroom -czf "/backups/data-$backup_stamp.tgz" -C /data .
sudo tar -tzf "backups/data-$backup_stamp.tgz" > /dev/null
echo "Backup verified: $PWD/backups/data-$backup_stamp.tgz"
)
```

Confirm the backup exists and tar can list it before proceeding. It contains SQLite and any local covers; .env is stored separately and contains secrets. Maintain a separate recoverable S3 backup/versioning policy. If backup fails, restart the existing container and investigate before updating.

The one-off backup needs `DAC_OVERRIDE` because the service drops all capabilities: container root otherwise cannot write into your user-owned `700` backup directory or read files restricted to another UID. This capability is added only for the backup command. Keep the backup directory private. The bind mount is `"$PWD/backups:/backups"`, with no backslash before the colon.

If present, `compose.https.yaml` is a server-specific override; keep it and include it in configuration backups. The `COMPOSE_FILE` setting above selects both files for stop, backup, rebuild, startup, and device provisioning. Alternatively pass `-f compose.yaml -f compose.https.yaml` explicitly each time. If your override has another filename, back up that file too.

## Build and apply

### β-009: black-bag details controls and contrast

Update the server to show the black-bag toggle immediately after duplicate copy on comic details in both Android and the browser. The icon now stays black with a white glow for contrast. Browser collection tiles still omit that toggle. These changes use the existing Android β-008 APK; no APK reinstall is required.

### β-008: queued Android and slideshow changes

Update the server for the new black-bag and slideshow icons, reordered menu with **Scan Comic**, centered Android Want List controls, main-menu slideshow settings, and direct full-screen slideshow launch with **Exit**. The icons and these screens are served by DangerRoom. Install the Android β-008 APK from the [Android guide](android.md) to receive the outlined startup badge and its lower-right shadow; that startup change is native to the APK. Existing device credentials remain valid.

### β-004: shared black bags and the Android menu

β-004 stores slideshow black bags in SQLite schema 6. Follow the stopped-container backup above before updating. Update the server for the new menu, fourth Ø collection control, full-inventory slideshow, and automatic full-screen playback; these screens are served by DangerRoom. The new Android β-004 APK is linked in the [Android guide](android.md). Existing Android β-002 clients remain compatible with the updated server.

When each device next opens the slideshow, its earlier local exclusions are saved as shared black bags. Maximum-cover settings and remembered subsets are retired. Remove black bags using Ø in My Collection. No collection entries, ratings, wants, or reading logs are removed.

### β-003: restore trusted browser access; provision Android separately

Android follows the same device allowlist model as Quartermaster and Heroes Feast: generate a device ID and secret on the server, then enter both in the Android client. Browser access keeps its original trust model and does not require a login by default. The Android β-002 APK remains compatible with server β-003.

If you followed the original β-002 browser-key instructions, edit `.env`:

```sh
vi .env
```

Set `REQUIRE_AUTH=false` (or leave it unset). The old `DANGERROOM_ADMIN_TOKEN` can be removed; it is not an Android credential. Rebuild and recreate the container using the commands below to apply the corrected Compose default. A host Node.js installation is not required.

Optional browser sign-in is available only if you deliberately set `REQUIRE_AUTH=true` and configure `DANGERROOM_ADMIN_TOKEN` to a random secret of at least 32 characters (`openssl rand -hex 32`). It is separate from Android device approval and is not needed for the default deployment.

```sh
(
set -e
cd "${DANGERROOM_DIR:-$HOME/DangerRoom}"
test -f compose.yaml
test -f .env
git pull --ff-only
sudo docker compose build --pull
sudo docker compose up -d --force-recreate
sudo docker compose ps
sudo docker compose logs --tail=100 dangerroom
)
```

### Check health at the address exposed by your deployment

After recreating the container, run the repository's health-check script:

```sh
cd "${DANGERROOM_DIR:-$HOME/DangerRoom}" && bash scripts/health-check.sh
```

The script reads only `DANGERROOM_URL` from the updated container's environment, then checks its `/api/health` endpoint. Node runs inside the container; it does not need to be installed on the host. The script uses the checkout's `.env` and configured Compose overrides, without sourcing `.env` as shell code or printing other environment values. It exits unsuccessfully if the URL is missing, Compose fails, or the health request fails. Changes to `.env` require container recreation before the script sees them. The request runs from the server, so the configured address must be reachable there; it does not have to be accessible from the public internet.

An HTTPS override containing `ports: !reset []` removes that host port mapping. In that setup, localhost curl reports **Failed to connect** even when the app is healthy. A log line such as `DangerRoom β-002 · http://0.0.0.0:4340` describes the listener **inside the container**; it does not mean port 4340 is exposed on the host. Use the HTTPS hostname instead. A failed HTTPS check still needs investigation; inspect the Compose service and reverse proxy.

Confirm the health JSON reports the expected build label, then check the saved collection, a cover, and Reading Log in the browser. Schema changes apply automatically at startup, making the stopped-app backup essential. Image rebuilds do not alter .env or erase the volume. To change credentials/configuration, vi .env then sudo docker compose up -d --force-recreate (restart alone does not reload Compose environment values).

### After the update: approve Android devices

Once the rebuilt container is running and the health check reports the expected version, use [Device token management](devices.md) to issue, list, revoke, or replace Android credentials. Then follow [Android installation](android.md) to enter the hostname, device ID, and secret on the phone or tablet. Existing enabled device credentials survive normal container updates; you do not need to reissue them for each release.

## Roll back

If a build fails before startup, the previous container/volume remains available; use sudo docker compose up -d --no-build to resume it. For a failed running update:

1. Stop it with sudo docker compose stop dangerroom.
2. Restore the source revision recorded in previous-revision.txt (git switch --detach COMMIT), and restore the matching .env from backup. Do not overwrite uncommitted local work.
3. If the new version migrated or changed data, restore the matching stopped-app backup to a **new empty** Docker volume, then use a Compose override mapping that volume to /data. Retain the failed volume for recovery. Do not unpack over a newer database or mix its WAL files with an older database. Existing S3 objects should remain available; the app does not delete them.
4. Retag the retained image with sudo docker image tag dangerroom:rollback dangerroom:local and run sudo docker compose up -d --no-build --force-recreate, using the same override if restoring into a new volume. Alternatively rebuild the old revision.
5. Verify health, data, and covers before accepting writes. Return to main only when ready to retry the update.

Never use sudo docker compose down -v during routine updates or rollback. Keep at least one verified data/config backup and the previous image until the update is accepted.

## Metron search pauses

Metron enforces a per-minute burst limit separately from its daily allowance. Scanning can need multiple API requests to resolve candidate issues and covers, so remaining daily quota does not rule out a temporary pause. DangerRoom respects Metron’s reset and Retry-After values; cached comics remain available. From β-012 onward, errors include the wait time in Android and distinguish burst versus daily limits when the response headers identify the exhausted window. Pauses recorded before this update retain a generic explanation until they expire. Wait for the stated interval before retrying.

### Provider diagnostics

After updating to β-013 or later, open **Metron diagnostics** in the site footer. It displays locally observed request attempts, scan usage, last reported rate-limit headers and reset times, active pauses, cache size, and recent response statuses. Refreshing the page does not call Metron. Counters persist in the existing SQLite database, start when this feature is installed, and do not include historical requests or other clients. Quota values are labeled snapshots, not live balances.

### Scan request fix in β-017

Update the server to remove unnecessary series-format lookups from Scan Comic. A fresh cover-results page needs one search plus up to five issue-detail calls; an empty barcode match falling back to title adds one search. Previously, format enrichment could request every distinct series on the search page before displaying any covers. Existing provider pauses are still respected until they expire. Diagnostics show the actual request attempts for each scan. No APK update is needed.

### Android barcode capture in β-018

Install the signed [β-018 Android APK](https://github.com/erickolb/DangerRoom/releases/tag/v0.1.0-beta.18) over the existing app for five-digit barcode supplement capture. Updating the server alone does not update native camera recognition. Include both the main barcode and supplement in the photograph and review the complete UPC before searching. If review warns that only the main barcode was captured, retake the photo or append the printed five digits, preserving zeros.

### Tablet supplement recognition in β-019

Install the signed [β-019 Android APK](https://github.com/erickolb/DangerRoom/releases/tag/v0.1.0-beta.19) over the existing app. This fixes cases where the main barcode is readable but the supplement bars are too soft: a unique five-digit line beside that barcode can be recovered from the existing on-device OCR result. Always review the full UPC before searching. Updating only the server cannot change camera recognition.

### Scan-result actions in β-020

Update the server to add Add, Want, and Read controls directly to scan-result tiles. The existing Android β-019 app loads these controls from the server; no APK update or device reconfiguration is needed. Ownership and Want List status apply to the exact cover, while reading status is shared by the issue.
