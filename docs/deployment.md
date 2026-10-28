# Deploy DangerRoom on astralplane

DangerRoom β-003 has a single shared collection with trusted browser access and approved Android device credentials. Browser sign-in is optional and disabled by default. Use an HTTPS reverse proxy. The default Compose port binds only to the server's loopback address. A reverse proxy running directly on astralplane can forward to http://127.0.0.1:4340. Preserve the original Host header; set ALLOWED_HOSTS to the public hostname (no scheme, path, or port). Browser and proxy requests must use the same hostname and port for writes to pass origin validation.

## Requirements and installation

Install Docker Engine and the Docker Compose v2 plugin for your server's Linux distribution. Verify on astralplane:

```sh
sudo docker version
sudo docker compose version
git clone https://github.com/erickolb/DangerRoom.git
cd DangerRoom
cp .env.example .env
chmod 600 .env
vi .env
```

Set METRON_API_TOKEN and ALLOWED_HOSTS (for example dangerroom.example.com). Leave REQUIRE_AUTH=false for the original browser behavior; no browser access key is required. Provision each Android installation with a server-issued device ID and secret using the commands in docs/android.md. For your existing S3 storage, set IMAGE_STORAGE=s3, S3_BUCKET=dangerroom-covers, AWS_REGION=us-east-1, and S3_PREFIX=covers. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for the IAM principal, plus AWS_SESSION_TOKEN only for temporary credentials. See [S3 configuration](s3.md) for permissions. Keep the bucket private. Host-machine AWS profiles are not automatically available inside Docker; use environment credentials or explicitly mount a read-only AWS profile with paths readable by container UID 1000.

Compose overrides HOST=0.0.0.0, PORT=4340, and DATA_DIR=/data inside the container. DANGERROOM_PORT in .env optionally changes the host-side loopback port. The image runs as UID/GID 1000, uses a read-only root filesystem, and stores SQLite and optional local covers in the named dangerroom-data volume. It contains no .env, local data, test files, or Git metadata. Building requires internet access to Node's image and the package registry.

## Transfer your current collection before first startup

Stop the Windows instance before copying its data directory so SQLite and any WAL files form a consistent snapshot. Transfer the data directory contents to ./import-data on astralplane using your preferred secure transfer tool. Preserve dangerroom.sqlite and any SQLite sidecar files together; include covers if any images still use local storage. Your migrated database already records the S3 bucket and keys, so its covers will read from S3 immediately. Local originals can be retained in a separate backup instead of the production volume once all referenced images have migrated. Do not transfer node_modules or place .env in /data.

```sh
sudo docker compose build --pull
sudo docker compose create
sudo docker compose cp ./import-data/. dangerroom:/data/
sudo docker compose run --rm --no-deps --user root --cap-add CHOWN --entrypoint chown dangerroom -R node:node /data
sudo docker compose up -d
sudo docker compose ps
curl --fail http://127.0.0.1:4340/api/health
sudo docker compose logs --tail=100 dangerroom
```

The one-off ownership command temporarily adds CHOWN because the normal service drops all Linux capabilities, including for root. The running application still retains no added capabilities.

For a genuinely fresh collection, omit create/cp/chown and simply build, then up -d. Never import over an existing production database. A new named volume gets the correct ownership from the image. Set ALLOWED_HOSTS before accessing via a hostname or LAN address; a 403 host error means it does not match. For a proxy in another container, arrange a shared Docker network and forward to dangerroom:4340 rather than the other container's localhost. Do not expose this app to the internet without access control.

To test listener availability without a reverse proxy, use an SSH tunnel from your PC: ssh -L 4340:127.0.0.1:4340 YOUR_USER@astralplane.chateaulore.net, then open http://127.0.0.1:4340/api/health. Choose another local port if the development app is running. Use the HTTPS hostname for normal browser access. Android requires HTTPS and server-issued credentials; see [Android setup](android.md).

The health endpoint verifies app availability, not AWS or Metron connectivity. Open My Collection and a saved cover to verify imported data and S3 access; then perform one Metron search. Check ownership, ratings, Want List, and Reading Log before treating production as authoritative. Stop editing the old development database after cutover; independent databases do not synchronize.

## Storage utilities inside Docker

Back up and stop the app before running migration utilities; use the same Compose environment and volume:

```sh
sudo docker compose stop dangerroom
sudo docker compose run --rm --no-deps dangerroom node scripts/migrate-covers-to-s3.mjs --dry-run
sudo docker compose run --rm --no-deps dangerroom node scripts/migrate-covers-to-s3.mjs
sudo docker compose up -d
```

Your current 22 covers have already migrated; importing that database requires no repeat migration. Migration retains any local originals. Back up S3 objects separately from SQLite. Never use sudo docker compose down -v unless you intend to delete the collection volume.

See [updates, backups, and rollback](updating.md) for every subsequent release.
