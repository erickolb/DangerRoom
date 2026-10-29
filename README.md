# DangerRoom

Comic inventory and reading journal. Current build: **β-016**.

[Website and Android download](https://erickolb.github.io/DangerRoom/) · [Releases](https://github.com/erickolb/DangerRoom/releases)

The [Android companion](docs/android.md) adds a mask startup screen, configurable HTTPS instance, device credentials, six-section menu, camera-assisted Metron lookup with exact variant selection, and an owned-cover slideshow. [Download the signed Android beta](https://github.com/erickolb/DangerRoom/releases/tag/v0.1.0-beta.8). Want List, text search, collection, ratings, and Reading Log share the web app's existing behavior and adapt to phones and tablets.

## Run locally

Requires Node.js 24 or later. Install dependencies with `pnpm install --frozen-lockfile`; no frontend build is needed.

1. The ignored `.env` file is prepared locally. On another checkout, copy `.env.example` to `.env`.
2. Sign in at [Metron](https://metron.cloud), open your account page, and find **API Tokens**. Create a token named **DangerRoom**.
3. Put that token after `METRON_API_TOKEN=` in `.env`. Keep it private; do not paste it into chat or commit it.
4. Run:

```sh
pnpm start
```

Open http://127.0.0.1:4340. Restart the process after changing `.env`. Without a token the app opens and saved collection pages work, but uncached Metron searches do not. `HOST`, `PORT`, `DATA_DIR`, and optional `ALLOWED_HOSTS` are documented in `.env.example`.

Each DangerRoom instance holds a single shared collection. Browser access retains the original trust model, with no sign-in by default. Android requires a server-issued device ID and secret, matching Quartermaster and Heroes Feast; credentials can be revoked on the server. Optional browser authentication is separate and must be explicitly enabled. See [deployment](docs/deployment.md), [container updates and rollback](docs/updating.md), and [device token management](docs/devices.md).

## Use

Terminology: **Find** looks within your collection or curated lists; **Search** queries Metron.

The default page centers comic search. Search by series name and optionally issue number or series start year, or enter a UPC in the expanded options. Search runs only when submitted and supports pagination.

Open a search result's collection, Want List, or read icon to choose its exact cover. In the cover picker, toggle the icons to save immediately; there is no separate collection Save or Delete action. Active icons glow coral for collection, green for Want List, and violet for read, following a consistent left-to-right rainbow progression. Search tiles show an owned variant thumbnail when available (the most recently added variant if several are owned), then an owned standard cover, then Metron artwork. Search tiles summarize each status across all covers of the issue; the cover picker still handles each exact cover. Buttons have tooltips and accessible names, and expose their active state to assistive technology.

**My Collection** defaults to My Collection. Collection views sort by series name, start year, and numeric issue number; variants and duplicate copies stay together. Each copy has its own collection toggle: turning it off removes only that copy, and turning it on again restores ownership with a new copy ID. Other copies, variants, read status, and ratings are preserved. The inactive card/control remains available until navigation or refresh so it can be toggled back on. Existing local metadata and covers are reused; a new cover or missing metadata is fetched from Metron if needed. There is no delete confirmation dialog.

Use the duplicate icon to add another copy of the selected cover. Every owned copy remains a distinct inventory entry. Read icons share one state across every instance of the same issue and open the reading-date dialog before marking read. **Read and Rated Comics** lists each read issue once, including comics you do not own. Local collection search includes series, publisher, issue, cover name, UPC, and ISBN. Details retain the exact edition, individual copy toggles, rating editor, and **Deep Search on Metron**.

Click a saved cover on its details page to open the full-resolution image in a lightbox. Close it with Escape, the close button, or a click outside the dialog. Images use the existing local/S3 storage route.

Comic details include **Owned Issues In Series** below **Owned Copies**. It lists owned issues with the same series title across years/volumes in year, volume, and numeric issue order, once per issue with a copy count. Links open the owned cover, preferring saved variant artwork. This uses only local metadata.

Use **Search Full Series on Metron** beneath the owned-series shelf to search that series by name. The slashed collection icon on Metron search hides issues owned in any variant. Filtering applies to each provider page; the total remains the Metron match count, and pagination stays available even when all issues on a page are hidden. The filter persists in the URL through searches and pagination.

When two or more issues in the exact Metron series run are rated, **Ratings In This Series** appears above the owned shelf. It charts numeric positive issue numbers up to the highest locally saved issue, including read-only entries. The chart starts at #1 and ends at the latest locally known issue. Dots represent ratings; solid bands span ±0.5 issue around each dot, clipped to that range. Transitions between consecutive rated issues are solid; dotted lines indicate only missing ratings. Dotted gaps use the next available rating, and the final score continues to the end. Nonnumeric issue labels are omitted. No Metron calls are made.

## Reading Log

**Reading Log** in the header opens a dated microjournal, newest date first and paginated by calendar month. Each entry has a small saved-cover thumbnail and issue link. Repeated readings, including multiple readings on the same date, remain separate entries. Each can be removed without changing read status, ratings, or ownership.

Tapping a read icon opens **Mark As Read**. **Record in Reading Log** defaults off; the reading-date calendar is always visible and defaults to today on your device. Clicking a day automatically turns recording on; browsing months does not. An optional half-star rating uses the same hover preview as the detail editor. **OK** marks the issue read and saves the optional rating and reading date together; Cancel/Escape changes nothing. Dates are stored as calendar dates without UTC conversion. Clicking read again to mark unread prompts Yes/No when entries exist: Yes removes all entries for the issue across covers, No keeps them while marking unread, and Cancel leaves everything unchanged. Ratings remain intact. Rating a comic still marks it read without silently creating journal entries.

Comic details have a **Log a Reading** button for recording additional dates, plus an issue-wide **Reading Log Entries** section directly below the graph area (above the owned-series shelf when no graph is shown). Entries from every cover appear here, with individual removal controls. Adding a reading marks the issue read but never adds an owned copy. The existing cover and metadata are reused. A first read from Metron search imports its standard cover and essential metadata; saved issues need no provider calls.

The reading-journal migration introduced schema 5 with an empty journal: no historical dates are inferred from read flags. Schema 6 adds shared, per-cover slideshow black bags. SQLite and covers are backed up as described above.

## Personal ratings

Collection tiles show five grey stars when unrated. Hover or focus a half-star to preview a score and click to save immediately. Five-star ratings glow brighter. Ratings stay shared across copies and variants and automatically mark the issue read.

Rate a comic with the five-star control in half-star steps (0.5–5), either while adding it or on its details page. The detail editor previews on hover and saves immediately when you click a half-star. Saving a rating automatically marks the issue as read. The same personal rating is displayed on every owned copy and variant, and in the Read collection; it is separate from Metron's content rating.

A rating alone is enough to add a comic as read without claiming ownership. Adding more copies preserves its existing rating unless you explicitly select a new one. The circled X beside a saved score (**Clear rating**) removes the score and keeps read status. Explicitly marking unread keeps the score; saving a rating again marks it read. Existing collections migrate automatically and start unrated. No Metron requests are needed to rate saved issues.

## Want List

Toggle the shopping-list icon after selecting a cover, or on a read-only comic's details page. **Want List** in the main navigation opens its separate listing with local search. Untoggle its green shopping-list icon to remove the want, or toggle its collection icon on to acquire that exact cover, fetching collection metadata behind the scenes if needed. Inactive cards remain until navigation/refresh to allow re-toggling. Clicking the cover/title opens the official Metron issue page in a new tab; wanted items have no local detail page.

Wants are specific to a cover, unlike read status and ratings. Owning the standard cover does not stop you wanting a variant. Adding an owned copy removes only that exact want in the same database transaction; trying to want an owned cover does nothing, with the option slightly greyed out. Reading/rating alone does not claim ownership or remove a want. Duplicate wants share one list entry. Removing an owned copy does not automatically restore an old want.

Only issue ID/name/number, series ID/name/start year/volume, cover date, official Metron URL, selected edition key/name/source image, a local cover filename, and added timestamp are stored in the wants table. Want-only entries create no inventory issue, edition, copy, reading, or rating records. The existing temporary provider lookup cache may contain the full API response while resolving variants. Images reuse the local original-file store, sufficient for thumbnails; an absent provider image displays as unavailable. Acquiring a cover reuses its file when the source URL matches. A failed image download does not save the want. This feature stores wants locally and does not modify Metron's wish list.

## Storage and API use

- `data/dangerroom.sqlite`: issues, selected editions, individual copies, reading records, personal ratings, want-list records, lookup cache, and provider cooldown state.
- `data/covers/`: original supplied image bytes, without thumbnail substitution, resizing, or recompression; SHA-256 filenames reuse identical files. Resolution depends on the image Metron actually supplies; no separate higher-resolution endpoint is documented. Covers are limited to 25 MB and validated as JPEG, PNG, WebP, or GIF.
- A new cover must download successfully before the entry is saved. If Metron has no cover, the entry can be saved with an explicit unavailable-cover placeholder.
- Search caches last 6 hours; issue-detail caches last 24 hours. Concurrent identical lookups share one request. Persistent saved metadata and covers are used for collection browsing with no Metron calls.
- Provider requests are serialized and paced at 3.1 seconds. Exhausted rate-limit headers and `Retry-After` persist a cooldown rather than repeatedly calling Metron. There is no crawling or background synchronization.
- Metron credentials are server-only. DangerRoom uses only Metron GET endpoints and does not modify your Metron collection.
- Optional private AWS S3 cover storage and a resumable local-to-S3 migration are documented in [S3 configuration](docs/s3.md). SQLite stays local. Back up the database, local covers, S3 objects, and configuration together; covers are deliberately retained after copy removal.

See [Metron field inventory and initial local-data choices](docs/metron-fields.md) and [API and data model](docs/api.md).

Use **Filters** beside the Metron results heading to select one or more series types. No selected types means all types; **Clear** resets only that filter. Apply combines the selected types with hide-owned on the current provider page, retaining the Metron total and pagination. Selections persist in the URL and through a new search. The complete series-type catalog is fetched on opening the dropdown and cached for 24 hours; if unavailable, types on the current results page remain selectable.

## Comic format

New imports retain Metron's `series.series_type` as an `id`/`name` object, or null if absent. Lightweight wants also retain it. Comic details display **Format**, such as Trade Paperback or Limited Series. TPB and HC formats display as white PNG lozenges with transparent block lettering between the title and number throughout the app. Their image alt text spells out Trade Paperback and Hardcover. Stored names, numbers, and series volume retain their existing meanings. Search reuses types in inventory, wants, and retained detail cache first; unknown series use one shared series-detail lookup cached for 24 hours. Badge PNGs are prebuilt; `scripts/generate-format-badges.ps1` regenerates them from code on Windows.

For older records, stop the app and preview `pnpm run backfill:series-types --dry-run`, then run `pnpm run backfill:series-types`. This operator utility uses retained issue-detail cache entries (even expired entries still present in SQLite), never calls Metron, and creates a consistent SQLite backup under `DATA_DIR/backups/` before updating missing types. It also reuses types already stored on other issues in the same series. If any series cannot be resolved, no records are updated; preserve or obtain the missing detail data before rerunning. Only series_type fields in issue/Want List JSON are changed. Existing types are preserved, and rerunning after success makes no changes. Restart the app afterward.

## Checks and release history

The minimal public download website lives in `website/` and deploys to GitHub Pages through `.github/workflows/pages.yml`. Keep its displayed Android version and APK/release links aligned with `docs/android.md` and each published Android build. It is separate from the self-hosted collection application in `public/`.

```sh
pnpm run check
pnpm test
```

Tests use isolated temporary databases and simulated Metron responses, never your collection or API credentials. Live Metron verification requires the local token.

[`public/releases.js`](public/releases.js) drives the footer build label and in-app Changelog. Each user-requested app change advances one build; related implementation and verification fixes stay in that build. Research alone does not advance the build. Stay in α until the user announces a new phase. Keep the package prerelease suffix aligned. See [Changelog](CHANGELOG.md).

## Credits

- `public/black-bag.png` is the original generated black-bag design; `public/black-bag.svg` is the clean vector adaptation used in small controls.

- Slideshow by Sentya Irma from <a href="https://thenounproject.com/browse/icons/term/slideshow/" target="_blank" rel="noopener noreferrer" title="Slideshow Icons">Noun Project</a> (CC BY 3.0). `public/slideshow.png` is the Cover Slideshow menu icon; its embedded bottom-left credit text is removed.

- manual guide by Idad Muchlisin Ro Is from <a href="https://thenounproject.com/browse/icons/term/manual-guide/" target="_blank" rel="noopener noreferrer" title="manual guide Icons">Noun Project</a> (CC BY 3.0). `public/reading-log.png` is the Reading Log icon; its bottom text strip is cleared.

- duplicate by Yafet bouchagra from <a href="https://thenounproject.com/browse/icons/term/duplicate/" target="_blank" rel="noopener noreferrer" title="duplicate Icons">Noun Project</a> (CC BY 3.0). `public/duplicate.png` is the add-another-copy icon.

- Metron logo: [The Metron Project](https://github.com/Metron-Project/metron/blob/master/static/site/img/metron.svg); atom mark extracted without lettering, used on collection search buttons and in the header.

- boxes by Pictogramma from <a href="https://thenounproject.com/browse/icons/term/boxes/" target="_blank" rel="noopener noreferrer" title="boxes Icons">Noun Project</a> (CC BY 3.0). `public/boxes.png` is the My Collection tab icon.
- Star by MihiMihi from <a href="https://thenounproject.com/browse/icons/term/star/" target="_blank" rel="noopener noreferrer" title="Star Icons">Noun Project</a> (CC BY 3.0). `public/star.png` is the Read and Rated Comics tab icon.

- <a href="https://www.flaticon.com/free-icons/hero" title="hero icons">Hero icons created by Magnific - Flaticon</a>. `public/mask.png` is the header icon and favicon.
- box add by Epic Icon Designs from <a href="https://thenounproject.com/browse/icons/term/box-add/" target="_blank" rel="noopener noreferrer" title="box add Icons">Noun Project</a> (CC BY 3.0). `public/box-add.png` is the ownership/add action icon.
- Book check by Ardiansyah from <a href="https://thenounproject.com/browse/icons/term/book-check/" target="_blank" rel="noopener noreferrer" title="Book check Icons">Noun Project</a> (CC BY 3.0). `public/book-check.png` is the read action icon.
- shopping list by Atif Arshad from <a href="https://thenounproject.com/browse/icons/term/shopping-list/" target="_blank" rel="noopener noreferrer" title="shopping list Icons">Noun Project</a> (CC BY 3.0). `public/shopping-list.png` is the Want List icon.
- [CC BY 3.0 license](https://creativecommons.org/licenses/by/3.0/). The seven Noun Project icons have their embedded attribution text removed from the bottom margin; creator credits and license links are retained here and in the app. Icon artwork and canvas sizes are unchanged. CSS inverts the icons for contrast on dark controls.
- Comic metadata and images: [Metron](https://metron.cloud). Cover artwork belongs to its respective rights holders.

These credits also appear in the footer's collapsed **Credits** section. The visual defaults use deep wine surfaces, scarlet accents, warm text, Georgia headings, system body text, rounded panels, and responsive controls.

The Filters dropdown also offers **Series Name** checkboxes for exact title matching. Names are gathered from the current results page, with active selections retained across pages. Selecting a name includes all runs with that exact name; multiple names are combined, then narrowed by type and hide-owned filters. Clear resets both dropdown selections.
