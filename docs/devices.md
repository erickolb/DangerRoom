# Device token management

DangerRoom uses a server-issued device ID and secret to approve each Android installation, following the Quartermaster and Heroes Feast model. Browser access is independent and requires no sign-in by default.

**Finish updating and starting the DangerRoom container before running these commands.** The running image must include `scripts/devices.mjs` (server β-002 or later). Pulling the source alone does not update that image. See [container updates](updating.md) first if needed.

## Commands on astralplane

Run from your deployed `~/DangerRoom` checkout. These commands include your `compose.https.yaml` reverse-proxy override. For installations using only `compose.yaml`, omit `-f compose.yaml -f compose.https.yaml`. Node runs inside the container; it does not need to be installed on the host.

### Issue a credential

```sh
sudo docker compose -f compose.yaml -f compose.https.yaml exec \
  dangerroom node scripts/devices.mjs add "Eric's phone"
```

Use a recognizable label and a separate credential for each phone or tablet. The command prints `deviceId` and `token`; the secret is shown only once.

In Android's **Instance and device settings**, enter:

| Android field | Value |
| --- | --- |
| DangerRoom hostname | Your instance, such as `dangerroom.chateaulore.net` |
| Device ID | The returned `deviceId` |
| Device secret | The returned `token` |

Tap **Save and test connection**. Store and deliver the credential privately. This secret is not a Metron token or the optional browser access key.

### List devices

```sh
sudo docker compose -f compose.yaml -f compose.https.yaml exec \
  dangerroom node scripts/devices.mjs list
```

The list shows `id`, `label`, and `enabled`: **1** means approved; **0** means revoked. It does not reveal secrets. Copy the device's `id` when revoking it.

### Revoke a credential

Replace `DEVICE_ID` with the actual ID from the list:

```sh
sudo docker compose -f compose.yaml -f compose.https.yaml exec \
  dangerroom node scripts/devices.mjs revoke DEVICE_ID
```

Revocation blocks subsequent requests using that credential without restarting the server. The disabled record remains in the list; this command does not delete it. Already displayed or downloaded data cannot be recalled. Browser access and other approved devices are unaffected.

### Replace a lost or exposed secret

The server stores only a hash, so an existing secret cannot be retrieved. Revoke the old device ID, issue a new credential with `add`, and update both fields in Android. Use the same procedure when replacing or reinstalling a device. A copied credential can impersonate its approved installation; it is not a hardware fingerprint.

## Source-only installations

From the DangerRoom checkout with Node 24 or later:

```sh
pnpm devices add "Eric's phone"
pnpm devices list
pnpm devices revoke DEVICE_ID
```

Use the same `.env` and `DATA_DIR` as the running app. Device records live in the instance's SQLite database and persist across container rebuilds when its data volume is retained.

See [Android installation](android.md) for client setup and [API documentation](api.md) for request authentication.
