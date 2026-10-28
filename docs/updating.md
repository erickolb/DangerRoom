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

### Required once for β-002: browser access key

β-002 adds Android device access and locks down Docker-hosted collection APIs and saved covers. Before rebuilding, generate a random browser key locally:

```sh
openssl rand -hex 32
vi .env
```

Set `DANGERROOM_ADMIN_TOKEN=` to that generated value (at least 32 characters). The command uses OpenSSL on the host; a host Node.js installation is not required for Docker deployment. Keep the key private and store it in your password manager. Compose refuses to start without the key. Open DangerRoom through your existing HTTPS hostname and use the key at the sign-in screen; browser sessions last 24 hours. The public health endpoint remains available for container checks. Direct local HTTP cannot use the Secure browser cookie; use HTTPS for authenticated browser access.

Provision each phone/tablet after the updated container starts, following [Android installation and device management](android.md). Do not put the browser access key into the Android app. For trusted-network source-only installations `REQUIRE_AUTH=false` retains the earlier browser behavior, but mobile routes still require credentials. Keep authentication enabled on publicly accessible instances.

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
