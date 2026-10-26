# DangerRoom

Chateau Lore comic inventory and reading journal. Current build: **α-002**.

## Run locally

Requires Node.js 24 or later. No dependency installation or frontend build is needed.

1. The ignored `.env` file is prepared locally. On another checkout, copy `.env.example` to `.env`.
2. Sign in at [Metron](https://metron.cloud), open your account page, and find **API Tokens**. Create a token named **DangerRoom**.
3. Put that token after `METRON_API_TOKEN=` in `.env`. Keep it private; do not paste it into chat or commit it.
4. Run:

```sh
npm start
```

Open http://127.0.0.1:4340. Restart the process after changing `.env`. Without a token the app opens and saved collection pages work, but uncached Metron searches do not. `HOST`, `PORT`, `DATA_DIR`, and optional `ALLOWED_HOSTS` are documented in `.env.example`.

This MVP is a single personal collection, bound to loopback by default. It has no account/login system. Internet hosting and Docker deployment have not been configured.

## Use

The default page centers comic search. Search by series name and optionally issue number or series start year, or enter a UPC in the expanded options. Search runs only when submitted and supports pagination.

Choose **Choose & add**, select the matching cover, and select **I own this copy**, **I've read this**, or both. Each owned save creates a new UUID inventory entry, including an identical cover added twice. Read status belongs to the issue, independent of ownership, and marking read again does not duplicate the reading record. A previously read issue stays read when you later add an owned copy without checking Read; use **Mark unread** on its details to clear that status explicitly.

**My Collection** defaults to Owned comics. **Read comics** lists read issues once each, including comics you do not own. Local collection search includes series, publisher, issue, cover name, UPC, and ISBN. Details show the selected edition, individual owned copies, read status, and **Deep Search on Metron**. Removing a copy does not remove another copy or the reading record. Adding another copy from local details requires no Metron lookup when its metadata and cover are already stored.

## Storage and API use

- `data/dangerroom.sqlite`: issues, selected editions, individual copies, reading records, lookup cache, and provider cooldown state.
- `data/covers/`: original supplied image bytes, without thumbnail substitution, resizing, or recompression; SHA-256 filenames reuse identical files. Resolution depends on the image Metron actually supplies; no separate higher-resolution endpoint is documented. Covers are limited to 25 MB and validated as JPEG, PNG, WebP, or GIF.
- A new cover must download successfully before the entry is saved. If Metron has no cover, the entry can be saved with an explicit unavailable-cover placeholder.
- Search caches last 6 hours; issue-detail caches last 24 hours. Concurrent identical lookups share one request. Persistent saved metadata and covers are used for collection browsing with no Metron calls.
- Provider requests are serialized and paced at 3.1 seconds. Exhausted rate-limit headers and `Retry-After` persist a cooldown rather than repeatedly calling Metron. There is no crawling or background synchronization.
- Metron credentials are server-only. DangerRoom uses only Metron GET endpoints and does not modify your Metron collection.
- No AWS integration yet. Back up the entire `data/` directory and `.env` separately while the app is stopped. Covers are deliberately retained after copy removal; automatic file cleanup is deferred.

See [Metron field inventory and initial local-data choices](docs/metron-fields.md) and [API and data model](docs/api.md).

## Checks and release history

```sh
npm run check
npm test
```

Tests use isolated temporary databases and simulated Metron responses, never your collection or API credentials. Live Metron verification requires the local token.

[`public/releases.js`](public/releases.js) drives the footer build label and in-app Changelog. Each user-requested app change advances one build; related implementation and verification fixes stay in that build. Research alone does not advance the build. Stay in α until the user announces a new phase. Keep the package prerelease suffix aligned. See [Changelog](CHANGELOG.md).

## Credits

- <a href="https://www.flaticon.com/free-icons/hero" title="hero icons">Hero icons created by Magnific - Flaticon</a>. `public/mask.png` is the header icon and favicon.
- box add by Epic Icon Designs from <a href="https://thenounproject.com/browse/icons/term/box-add/" target="_blank" rel="noopener noreferrer" title="box add Icons">Noun Project</a> (CC BY 3.0). `public/box-add.png` is the ownership/add action icon.
- Book check by Ardiansyah from <a href="https://thenounproject.com/browse/icons/term/book-check/" target="_blank" rel="noopener noreferrer" title="Book check Icons">Noun Project</a> (CC BY 3.0). `public/book-check.png` is the read action icon.
- [CC BY 3.0 license](https://creativecommons.org/licenses/by/3.0/). Source icon files are retained unchanged; CSS inverts the action icons for contrast on dark controls.
- Comic metadata and images: [Metron](https://metron.cloud). Cover artwork belongs to its respective rights holders.

These credits also appear in the footer's collapsed **Credits** section. The visual defaults follow HeroesFeast and Quartermaster: dark plum, lavender accents, Georgia headings, system body text, rounded panels, and responsive controls.
