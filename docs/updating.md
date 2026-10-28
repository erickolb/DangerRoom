# Update DangerRoom on astralplane

Run from the original DangerRoom checkout; changing the Compose project/directory name can select a different named volume. These commands build from source; no registry login or prepublished image is required. Keep .env and the named data volume across updates.

## Back up before updating

Run in a shell on astralplane:

```sh
cd /path/to/DangerRoom
if [ -f compose.https.yaml ]; then export COMPOSE_FILE=compose.yaml:compose.https.yaml; fi
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
```

Confirm the backup exists and tar can list it before proceeding. It contains SQLite and any local covers; .env is stored separately and contains secrets. Maintain a separate recoverable S3 backup/versioning policy. If backup fails, restart the existing container and investigate before updating.

The one-off backup needs `DAC_OVERRIDE` because the service drops all capabilities: container root otherwise cannot write into your user-owned `700` backup directory or read files restricted to another UID. This capability is added only for the backup command. Keep the backup directory private. The bind mount is `"$PWD/backups:/backups"`, with no backslash before the colon.

If present, `compose.https.yaml` is a server-specific override; keep it and include it in configuration backups. The `COMPOSE_FILE` export above applies both files to subsequent Compose commands in this shell, including stop, backup, rebuild, startup, and device provisioning. Alternatively pass `-f compose.yaml -f compose.https.yaml` explicitly each time. If the override removes the localhost port, check health with `curl --fail https://dangerroom.chateaulore.net/api/health` instead of the localhost URL below.

## Build and apply

### β-003: restore trusted browser access; provision Android separately

Android follows the same device allowlist model as Quartermaster and Heroes Feast: generate a device ID and secret on the server, then enter both in the Android client. Browser access keeps its original trust model and does not require a login by default. The Android β-002 APK remains compatible with server β-003.

If you followed the original β-002 browser-key instructions, edit `.env`:

```sh
vi .env
```

Set `REQUIRE_AUTH=false` (or leave it unset). The old `DANGERROOM_ADMIN_TOKEN` can be removed; it is not an Android credential. Rebuild and recreate the container using the commands below to apply the corrected Compose default. A host Node.js installation is not required.

Provision each phone/tablet after the updated container starts, following [Android installation and device management](android.md). For your HTTPS setup:

```sh
sudo docker compose -f compose.yaml -f compose.https.yaml exec dangerroom node scripts/devices.mjs add "Eric's phone"
```

Enter the returned `deviceId` and `token` into Android's **Device ID** and **Device secret** fields, together with your DangerRoom hostname. Save the secret privately: it is shown only once. Mobile routes always require an enabled device, independently of browser access.

Optional browser sign-in is available only if you deliberately set `REQUIRE_AUTH=true` and configure `DANGERROOM_ADMIN_TOKEN` to a random secret of at least 32 characters (`openssl rand -hex 32`). It is separate from Android device approval and is not needed for the default deployment.

```sh
git pull --ff-only
sudo docker compose build --pull
sudo docker compose up -d --force-recreate
sudo docker compose ps
sudo docker compose logs --tail=100 dangerroom
```

### Check health at the address exposed by your deployment

For astralplane's HTTPS reverse-proxy setup, use:

```sh
curl --fail https://dangerroom.chateaulore.net/api/health
```

For another instance, replace `dangerroom.chateaulore.net` with its configured HTTPS hostname. The hostname must be included in `ALLOWED_HOSTS` and routed to DangerRoom by the reverse proxy.

Only use the following check when Compose publishes the container port on the host (the default `compose.yaml` configuration). Adjust `4340` if `DANGERROOM_PORT` differs:

```sh
curl --fail http://127.0.0.1:4340/api/health
```

An HTTPS override containing `ports: !reset []` removes that host port mapping. In that setup, localhost curl reports **Failed to connect** even when the app is healthy. A log line such as `DangerRoom β-002 · http://0.0.0.0:4340` describes the listener **inside the container**; it does not mean port 4340 is exposed on the host. Use the HTTPS hostname instead. A failed HTTPS check still needs investigation; inspect the Compose service and reverse proxy.

Confirm the health JSON reports the expected build label, then check the saved collection, a cover, and Reading Log in the browser. Schema changes apply automatically at startup, making the stopped-app backup essential. Image rebuilds do not alter .env or erase the volume. To change credentials/configuration, vi .env then sudo docker compose up -d --force-recreate (restart alone does not reload Compose environment values).

## Roll back

If a build fails before startup, the previous container/volume remains available; use sudo docker compose up -d --no-build to resume it. For a failed running update:

1. Stop it with sudo docker compose stop dangerroom.
2. Restore the source revision recorded in previous-revision.txt (git switch --detach COMMIT), and restore the matching .env from backup. Do not overwrite uncommitted local work.
3. If the new version migrated or changed data, restore the matching stopped-app backup to a **new empty** Docker volume, then use a Compose override mapping that volume to /data. Retain the failed volume for recovery. Do not unpack over a newer database or mix its WAL files with an older database. Existing S3 objects should remain available; the app does not delete them.
4. Retag the retained image with sudo docker image tag dangerroom:rollback dangerroom:local and run sudo docker compose up -d --no-build --force-recreate, using the same override if restoring into a new volume. Alternatively rebuild the old revision.
5. Verify health, data, and covers before accepting writes. Return to main only when ready to retry the update.

Never use sudo docker compose down -v during routine updates or rollback. Keep at least one verified data/config backup and the previous image until the update is accepted.
