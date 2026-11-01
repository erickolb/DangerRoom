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

### β-027 / Hardlight 1.0.1: three-strike slideshow recovery

Follow the backup, rebuild, and recreate commands below, then exit and reopen Cover Slideshow once to load the updated server code. Existing Hardlight APKs also receive this fix; installing the signed [Hardlight 1.0.1 APK](https://github.com/erickolb/DangerRoom/releases/tag/v1.0.1) over 1.0.0 retains device credentials and settings. Android versionCode is 14. Installing the APK alone does not apply the server fix.

Each failed image receives one strike and stays in rotation until strike three. Loading an image that already has strikes clears every remaining image's strikes. Loading a zero-strike image leaves other strikes untouched. After a failure, the next image is attempted after 3 seconds; a stalled load or decode times out after 20 seconds. The previous visible image remains displayed. Strike counts exist only in the current slideshow session and never change collection records or black bags.

If the lineup is exhausted, a spinner appears and the slideshow waits 10 minutes before fetching the full eligible collection and resetting all strikes, including covers previously dropped from playback. Failed inventory requests and genuinely empty collections also wait 10 minutes before another initialization attempt. These intervals replace β-026's 15-second retry. Exiting cancels pending playback and recovery work. No schema migration is added.

For verification, start a slideshow and briefly restart with `sudo docker compose restart dangerroom`: failed covers should remain in subsequent rotations until three failures. A successful load of a previously failed cover should restore the full surviving lineup's strike allowance. A prolonged outage should eventually show the spinner and recover on a 10-minute initialization attempt once service returns.

### β-026: slideshow recovery after container restarts

Rebuild and recreate the server using the commands below. Existing Hardlight APKs remain compatible; exit and reopen the slideshow once after updating to load the new JavaScript.

Previously, every failed cover request removed that cover from the current playlist permanently. A container restart could exhaust the playlist and show “No eligible owned covers” even with an intact collection. The slideshow now retains the last visible image, distinguishes unavailable images from an empty collection, and reloads inventory and retries artwork every 15 seconds after exhaustion or inventory errors. It also retries when the device reports it is back online. Playback resumes automatically if it was playing; exiting cancels recovery. An empty collection is checked again automatically too.

To verify recovery, start the slideshow, restart the service with `sudo docker compose restart dangerroom`, and confirm playback continues or resumes after availability returns. For an outage lasting long enough to exhaust the playlist, expect “Cover images are temporarily unavailable” followed by automatic recovery. Collection records and shared black bags remain in the existing `/data` volume; retain the original Compose project and never remove its data volume during updates.

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

### Hardlight Android identity in β-021

The Android client is now nicknamed **Hardlight**, displayed as **Danger Room**, with application ID `net.chateaulore.hardlight`. It installs separately from the older `net.chateaulore.dangerroom` app and needs its own instance/device setup. The server and its collection are unchanged. Install the signed release from the [download website](https://erickolb.github.io/DangerRoom/), or choose **Install with Obtainium** and enable prerelease updates during beta. Future Hardlight updates retain this app ID and signing key.

### Hardlight 0.1.0 Android release

Install [Hardlight 0.1.0](https://github.com/erickolb/DangerRoom/releases/tag/v0.1.0) over the existing Hardlight β-021 app to keep its configuration. Android versionCode is 8 and the app ID remains `net.chateaulore.hardlight`. This is a normal GitHub release, so Obtainium does not need prerelease updates enabled. The server remains β-021 and needs no container update for this version-only Android release.

### Hardlight 0.1.1 launcher icon

Update through Obtainium or install the signed [Hardlight 0.1.1 APK](https://github.com/erickolb/DangerRoom/releases/tag/v0.1.1) over the existing Hardlight app. This applies the approved launcher icon and advances Android versionCode to 9. App ID, signing key, and local settings are retained. No server/container update is required.

## β-025 / Hardlight 1.0.0

Update the container using the backup and rebuild procedure above, then verify /api/health reports β-025 before installing Hardlight 1.0.0. The new server provides a five-section Android menu and removes all camera-search and retained-scan endpoints. The Android APK removes the corresponding camera/recognition code and dependencies.

Schema 7 automatically drops the retired scan_captures table, deleting its retained diagnostic images and hashes, and clears cover-hash search cache entries. Collection covers, copies, wants, ratings, Reading Log, device credentials, and slideshow black bags are preserved. Make the normal stopped-container backup before updating; exported diagnostic snapshots and older backups are separate files and are not removed by this upgrade. No new environment variables or upload limits are needed.

Install the signed [Hardlight 1.0.0 APK](https://github.com/erickolb/DangerRoom/releases/tag/v1.0.0) over Hardlight 0.1.4 to keep connection and slideshow settings. Application ID remains net.chateaulore.hardlight and versionCode advances to 13. The Android update clears obsolete scan settings and its old app-owned camera file.
