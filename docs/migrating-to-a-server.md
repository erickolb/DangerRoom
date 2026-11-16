# Migrate a local DangerRoom instance to a server

Use this guide to move an existing local collection to a Linux server running Docker Compose. For a fresh collection, start with [Run In a Container](../README.md#run-in-a-container). For later releases, use [updates, backups, and rollback](updating.md).

DangerRoom serves one shared collection. Browser access has no sign-in: anyone who can reach the web application can view and change it. Keep it on a private network or tailnet, or provide access control in front of it. Both Android and iOS Hardlight clients require HTTPS and server-issued device credentials.

## 1. Prepare the server

Install Docker Engine and the Docker Compose v2 plugin for your Linux distribution. Verify installation and prepare a checkout:

```sh
sudo docker version
sudo docker compose version
git clone https://github.com/erickolb/DangerRoom.git
cd DangerRoom
cp .env.example .env
chmod 600 .env
vi .env
```

Building requires internet access to the Node image and package registry. The container includes Node.js and dependencies; the server does not need its own Node installation.

Configure the new `.env` using your local instance's settings as a reference. Keep the Metron token private. Set `ALLOWED_HOSTS` to the hostname you will use, without a scheme, path, or port. Set `DANGERROOM_URL` to the full base address, such as `https://comics.example.net`. This address is used by the update guide's health check; it does not configure routing or replace `ALLOWED_HOSTS`.

Compose sets `HOST=0.0.0.0`, `PORT=4340`, and `DATA_DIR=/data` inside the container. Do not carry over a local machine's `DATA_DIR` path as a container storage location. The named `dangerroom-data` volume holds SQLite and local covers. The image runs as UID/GID 1000 with a read-only root filesystem.

If your collection uses S3, configure the same storage settings and credentials that can read its existing objects. SQLite remains local. Keep the bucket private; see [S3 configuration](aws-s3-setup.md) for permissions. Host-machine AWS profiles are not automatically available inside Docker: use environment credentials or explicitly mount a read-only profile readable by UID 1000. Moving the database does not copy S3 objects or change their recorded bucket and keys.

## 2. Plan access to the instance

The default Compose configuration publishes port 4340 only on the server's loopback interface. `DANGERROOM_PORT` optionally changes that host-side port. A reverse proxy running directly on the server can forward to `http://127.0.0.1:4340`. Preserve the original Host header; browser and proxy requests must use the same hostname and port for writes to pass origin validation. A 403 host error can mean `ALLOWED_HOSTS` does not match the request hostname.

For a proxy in another container, configure a shared Docker network and forward to `dangerroom:4340`, rather than the proxy container's localhost. Configure HTTPS and appropriate access control before allowing remote browser access.

If you create a Compose override for your proxy, keep using it for import, startup, and future updates. For example, if you name it `compose.https.yaml`, persist `COMPOSE_FILE=compose.yaml:compose.https.yaml` in `.env`. This file is deployment-specific and is not supplied by the repository.

For an initial browser test without a reverse proxy, open an SSH tunnel from your computer, replacing `YOUR_USER` and `YOUR_SERVER` with your SSH login and server hostname:

```sh
ssh -L 4340:127.0.0.1:4340 YOUR_USER@YOUR_SERVER
```

Then open http://127.0.0.1:4340. Choose a different local tunnel port if your local app still occupies 4340. Hardlight needs an HTTPS endpoint rather than this HTTP test address.

## 3. Stop and copy the local instance

Stop the local app before copying its data directory. Keep it stopped during the transfer and cutover so the server receives a consistent snapshot and no later edits are left behind.

Find the actual local directory configured by `DATA_DIR` (default `./data`). Make a backup and securely transfer its contents into `./import-data/` in the server checkout. Preserve `dangerroom.sqlite` and any SQLite sidecar files together. Include `covers/` and other data-directory content; some covers may remain local even when S3 is configured. Back up S3 objects separately if used.

The result should be `import-data/dangerroom.sqlite`, not an extra nested `import-data/data/dangerroom.sqlite`. Transfer configuration separately and keep `.env` private in the checkout; do not place it in `/data`. Do not transfer `node_modules`.

## 4. Import into a new container volume

Use a new, empty destination volume. Do not import over an existing server collection. Compose derives volume names from the project, so keep the checkout location and Compose project name consistent for future commands.

From the server checkout, build and create the container without starting the app, copy the snapshot, fix ownership, then start:

```sh
sudo docker compose build --pull
sudo docker compose create
sudo docker compose cp ./import-data/. dangerroom:/data/
sudo docker compose run --rm --no-deps --user root --cap-add CHOWN --entrypoint chown dangerroom -R node:node /data
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 dangerroom
```

The one-off ownership command temporarily adds CHOWN because the service normally drops all Linux capabilities, including for root. The running application retains no added capabilities. Startup applies any required database migrations, so keep the original snapshot and record the source revision before starting a newer version on it.

## 5. Verify and switch over

With the default port mapping, check the server listener:

```sh
curl --fail http://127.0.0.1:4340/api/health
```

If your proxy configuration removes the host port mapping, use the HTTPS instance address instead. A container log showing `0.0.0.0:4340` describes its internal listener, not necessarily an exposed host port.

The health endpoint verifies app availability, not Metron or S3 connectivity. Before accepting the migration:

- Open My Collection and several saved covers, including S3-backed images if used.
- Check copies, ratings, Want List, Reading Log, and slideshow exclusions.
- Perform one Metron search to verify the token and provider connectivity.
- Test HTTPS and device access using the [Android](hardlight-for-mobile.md#android) and [iOS](hardlight-for-mobile.md#ios) setup guides. Imported device credentials remain available unless revoked; issue separate credentials for new installations using [device management](mobile-device-token-management.md).

After verification, use the server as the authoritative instance and stop editing the old local database. Separate instances do not synchronize. Keep the stopped local snapshot as a recovery point. If validation fails, stop the server before returning to the local instance; writes made only on the server will not appear in that snapshot.

## Ongoing storage and updates

Preserve `.env`, the same Compose project, and the data volume across updates. Back up SQLite, local covers, configuration, and any S3 objects together. Never use `sudo docker compose down -v` during routine updates; it deletes the collection volume.

Existing S3 cover references need no repeat migration when imported with working access to the same objects. If you later choose to move local covers to S3, follow the backup, dry-run, and migration procedure in [S3 configuration](aws-s3-setup.md). Keep storage changes separate from the initial server move so each can be verified independently.

Use [updates, backups, and rollback](updating.md) for subsequent container releases.
