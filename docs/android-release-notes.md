# Hardlight 1.2.0-beta.4 for Android

Android beta prerelease · version code 20 · application ID `net.chateaulore.hardlight`.

- Default image-search hash distance is **14**, retaining slider range **10–20**.
- With **DangerRoom server 1.1.2**, regular and image search display matches immediately. Optional series-type lookups run sequentially after display, updating badges and filter options in place.
- Stop enrichment at quota exhaustion, on a lookup error, or when leaving/pausing the page. There is no automatic retry after the limit resets. A single in-flight request can finish into cache; later searches reuse successful lookups and can fill remaining gaps.
- Unknown-type results remain visible and labeled, including under explicit type filters. Quota exhaustion during enrichment does not discard successful matches.
- Update the server using [container update instructions](https://github.com/erickolb/DangerRoom/blob/main/docs/updating.md) for this behavior. The native minimum remains 1.1.0: beta 4’s native change is the default distance, and enrichment is provided by the matching server-delivered UI.
- Keep the scanner’s crop, corner adjustment, and rotation controls. **Next** proceeds directly to hashing and standard search results; no second review/editor screen.
- Stable Android and iOS remain at 1.1.0. All three feature TODOs stay unchecked until stable approval.

Obtainium users with prereleases enabled can update over earlier betas. The application ID and signing key are unchanged; code 20 updates code 19 without reinstalling. Google Play services and its first-use scanner download are required. Photographs stay on device; only the hash is sent.

Artifacts: `DangerRoom.apk`, `SHA256SUMS.txt`, `SIGNING-CERTIFICATE.txt`.
