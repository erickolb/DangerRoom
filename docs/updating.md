# Update a DangerRoom instance

Use this guide for routine updates of an existing instance. Choose the container or source procedure for your installation. Server and Hardlight releases are independent: updating the server does not install a new APK or IPA. Check the [Changelog](../CHANGELOG.md) and [release notes](https://github.com/erickolb/DangerRoom/releases) for compatibility requirements or additional steps before starting.

## 1. Prepare

Run commands from your existing DangerRoom checkout. Keep its location, Compose project name, data directory or volume, and configuration unchanged. Check for local work before pulling:

```sh
git status --short
git rev-parse HEAD
```

Record the current revision with your backup. Resolve local source changes before updating; do not discard them to make a pull succeed. Keep private configuration and deployment overrides backed up separately from Git. Do not copy example settings over your existing `.env`.

The container examples below use a Linux shell, Docker Engine, and Compose v2. Use the same Compose files for every operation. If you created an override, persist its selection in `.env`, for example `COMPOSE_FILE=compose.yaml:compose.https.yaml` for a file you created with that name, or supply the same `-f` options each time.

## 2. Stop and back up

Stop writes before copying SQLite. Preserve the database, any SQLite sidecar files, local covers, and configuration together. Back up S3 objects separately if used. Keep a recoverable copy off the application host and protect backups containing credentials.

### Container installation

Run this block from the existing checkout. It retains the current image for rollback, stops the service, and archives the data volume without starting the app:

```sh
(
set -e
mkdir -p backups
chmod 700 backups
backup_stamp=$(date +%Y%m%d-%H%M%S)
git rev-parse HEAD > "backups/revision-$backup_stamp.txt"
cp .env "backups/environment-$backup_stamp.env"
chmod 600 "backups/environment-$backup_stamp.env"
sudo docker image tag dangerroom:local dangerroom:rollback
sudo docker compose stop dangerroom
sudo docker compose run --rm --no-deps --user root --cap-add DAC_OVERRIDE --entrypoint tar -v "$PWD/backups:/backups" dangerroom -czf "/backups/data-$backup_stamp.tgz" -C /data .
sudo tar -tzf "backups/data-$backup_stamp.tgz" > /dev/null
echo "Backup verified: $PWD/backups/data-$backup_stamp.tgz"
)
```

Also copy every custom Compose/proxy configuration file into the backup. Confirm the archive contains `dangerroom.sqlite` and your local covers before proceeding. The temporary DAC_OVERRIDE capability allows the backup container to read restricted files and write into the private backup directory; it is not added to the running app.

If backup fails, do not update. Investigate the failure and resume the existing service with `sudo docker compose up -d --no-build` if needed. Do not overwrite the rollback image again until the update has been accepted.

### Source installation

Stop the running app (Ctrl+C for a foreground `pnpm start`, or stop the service with your process manager). Copy the entire directory selected by `DATA_DIR`—default `./data`—to a separate backup location. Copy `.env` and any service configuration, and record `git rev-parse HEAD`. Verify the copy is readable and contains the database and covers before continuing. Use your operating system's file-copy tools; the app must remain stopped throughout the copy and update.

## 3. Apply the update

### Container installation

```sh
(
set -e
git pull --ff-only
sudo docker compose build --pull
sudo docker compose up -d --force-recreate
sudo docker compose ps
sudo docker compose logs --tail=100 dangerroom
)
```

These commands build from source; no registry login or prepublished image is needed. A failed build stops the block before recreation. Resolve the failure or start the retained service image with `sudo docker compose up -d --no-build`.

Keep the named data volume. Never use `sudo docker compose down -v` during an update: it deletes that volume. Database migrations run automatically at startup, which is why a stopped-app backup is essential.

### Source installation

With Node.js 24 or later and pnpm installed, run each command only after the previous one succeeds:

```sh
git pull --ff-only
pnpm install --frozen-lockfile
pnpm start
```

If a process manager normally runs the app, start it through that manager instead of launching another copy with `pnpm start`. Preserve the same `.env`, working directory, and `DATA_DIR`. There is no frontend build step. Startup applies database migrations automatically.

After changing `.env`, restart a source process. For containers, run `sudo docker compose up -d --force-recreate`; a container restart alone does not reload Compose environment values.

## 4. Verify and resume use

Check `/api/health` at your actual instance address and confirm its build label matches the update. For the default local listener:

```sh
curl --fail http://127.0.0.1:4340/api/health
```

For a container deployment, set `DANGERROOM_URL` in `.env` to your base address (without `/api/health`) and recreate the container after changing it. On Linux, `bash scripts/health-check.sh` checks that address using the running container's configuration. If a proxy override removes the host port mapping, use the HTTPS hostname rather than localhost. An internal container listener does not imply an exposed host port.

Health verifies application availability, not Metron or S3 connectivity. Open the collection and saved covers, then check ratings, Want List, and Reading Log. Try one Metron search and, if applicable, an S3-backed cover. Review startup logs for errors before allowing normal use.

Reload browser pages and tap **Reload** on Hardlight's main menu to fetch updated server screens. If release notes require a native client update, follow [Hardlight for Mobile](hardlight-for-mobile.md). Existing enabled device credentials normally survive server updates; do not reissue them unless needed.

Keep the backup, recorded revision, and previous container image until the update is accepted.

## 5. Roll back if needed

Stop the updated app before recovery. Preserve its database separately if it has accepted writes: restoring a pre-update snapshot loses those newer changes, and separate snapshots do not merge automatically.

Restore the source revision recorded with the backup, for example `git switch --detach COMMIT` with the actual recorded commit. Do not overwrite uncommitted work. Restore the matching configuration. If startup migrated the database, or the update changed records, restore the matching stopped-app data snapshot too; do not run old code against a newer database or mix database and WAL files from different snapshots.

For containers, restore data into a **new empty** Docker volume and configure a Compose override to mount it at `/data`. Retain the failed volume for recovery. The [server migration guide](migrating-to-a-server.md#4-import-into-a-new-container-volume) describes copying data and fixing ownership. Extract an archived backup into a private staging directory first; do not unpack it over a live database. With the restored volume selected, use the retained image:

```sh
sudo docker image tag dangerroom:rollback dangerroom:local
sudo docker compose up -d --no-build --force-recreate
```

Alternatively, rebuild the recorded source revision. For a source installation, restore data into an empty directory, point `DATA_DIR` to it, run `pnpm install --frozen-lockfile` at the restored revision, and start through your normal process manager. Ensure any required S3 objects are still available.

Repeat verification before accepting writes. A detached checkout cannot use the normal pull procedure; return to your tracked branch only when ready to retry the update.

For optional data maintenance, see [series-format backfill](metron-data-mapping.md#fill-missing-comic-formats-in-older-records) and [S3 migration](aws-s3-setup.md). These are separate operations, not routine update steps.
