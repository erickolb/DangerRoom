# Hardlight 1.2.0-beta.5 for Android

Android beta prerelease · version code 21 · application ID `net.chateaulore.hardlight`.

- Keep the initial instance-version check behind Hardlight’s branded loading screen. Remove the separate Connecting / Checking server compatibility screen.
- If the instance is too old, show the existing update-required error with the minimum server version and this Hardlight version. Connection and authorization failures still show actionable errors, Retry, and instance settings.
- Restore normal system bars when opening the app, setup, or an error screen. Back during loading exits without scheduling duplicate checks.
- Android-only update. DangerRoom stays **1.1.2**, native minimum stays **1.1.0**, and no server container update is required for beta 5. Server 1.1.2 remains necessary for asynchronous search enrichment.
- Retain default hash distance **14**, scanner Next-to-search behavior, progressive metadata enrichment, and quota-stop behavior without automatic retries.
- Stable Android and iOS remain at 1.1.0. All three feature TODOs stay unchecked until stable approval.

Obtainium users with prereleases enabled can update over earlier betas. Code 21 updates code 20 without reinstalling; app ID and signing key are unchanged.

Artifacts: `DangerRoom.apk`, `SHA256SUMS.txt`, `SIGNING-CERTIFICATE.txt`.
