# DangerRoom API and data model

All endpoints are local to DangerRoom. JSON mutations require `Content-Type: application/json`. Server binds to `127.0.0.1:4340` by default. Host checks and same-origin mutation checks protect the local listener; these do not replace login/access control for internet deployment.

| Method and path | Behavior |
| --- | --- |
| `GET /api/health` | Build label and whether Metron credentials are configured; no secret values. |
| `GET /api/search?q=Batman&number=1&year=2024&page=1` | Cached provider issue search. `year` means series start year. `upc` can be used without `q`. |
| `GET /api/metron/issues/:id` | Cached provider issue metadata and cover selections, enriched with current local ownership/want flags, copy IDs, shared read status and personal rating. Local status is never cached as provider metadata. |
| `POST /api/entries` | `{issue_id, edition_key, owned: boolean, read: boolean, rating?: number|null}`; at least one status flag true or a non-null rating. Fetch authoritative metadata, validate exact edition, persist cover, then atomically save the entry/status. Every `owned:true` request intentionally adds another distinct copy. |
| `GET /api/collection?view=owned&q=…` | Local copy list, owned by default. Every copy is a separate item. `view=read` returns each read issue once. |
| `GET /api/issues/:id` | Local metadata, saved editions/covers, copies, and read record. No Metron call. |
| `PATCH /api/issues/:id/read` | `{read: boolean, edition_key}`. Mark read/unread independent of owned copies; a saved edition is required when setting true. |
| `PATCH /api/issues/:id/rating` | `{rating: number|null, edition_key}`. 0.5–5 in half-star steps; `null` clears. A non-null rating atomically marks the issue read. `edition_key` must reference a saved edition when rating. All copies and variants share the score. Clearing it preserves read status. |
| `GET /api/wants?q=…` | Lightweight wanted covers with local image filenames and official Metron links; no provider call. |
| `POST /api/wants` | `{issue_id, edition_key}`. Resolve authoritative cover metadata, save its image, and store only a lightweight want. Idempotent; owned covers silently return `{added:false,owned:true,wanted:false}`. |
| `DELETE /api/wants/:id/:edition_key` | Remove one exact wanted cover; idempotent, no effect on ownership/read/rating. |
| `DELETE /api/copies/:uuid` | Remove exactly one copy. Read status and other copies are preserved. The UI triggers this by untoggling the icon, without a separate delete button or confirmation. Local metadata/covers remain available for re-addition. |
| `GET /covers/:sha256.extension` | Locally stored cover. Only validated filenames and raster formats are served. |

## Tables

- `issues`: Metron issue ID, essential metadata JSON, first save timestamp.
- `editions`: composite `(issue_id,key)` identity, exact edition metadata JSON, optional cover filename. Only saved selections are persisted here.
- `copies`: UUID per owned copy, issue and edition references, added timestamp. No quantity column or uniqueness constraint on issue/edition.
- `reads`: one row per read issue, selected edition and original marked-read timestamp. No owned copy required.
- `issue_ratings`: one row per issue, integer `half_stars` (1–10) and updated timestamp; exposed as `user_rating` (0.5–5 or null). Separate from the provider content-rating metadata. Schema version 2 adds this table without altering existing inventory.
- `wants`: composite `(issue_id,edition_key)` identity, explicitly allowlisted high-level metadata JSON, local cover filename, added timestamp. Independent of the inventory tables. Schema version 3 adds this table without altering existing records. Saving ownership atomically deletes the matching want; the add-want transaction rechecks ownership to prevent stale/racing submissions.
- `cache`: expiring provider search/detail payloads. Removed expired rows on cache writes.
- `provider_state`: durable next-request and provider cooldown timestamps.

SQLite foreign keys enforce valid edition references. Mutations use prepared statements. A save transaction creates issue/edition and owned/read records together only after its cover downloads. Concurrent requests may create multiple intended copies, sharing the saved image. Copy deletion never triggers image deletion in this MVP.

Status errors use `{error}`. HTTP 429 includes `Retry-After`. Provider credentials never reach browser responses, URLs, or logs. Images are fetched without authorization headers, only from approved Metron HTTPS media hosts; redirects are refused.

## Cover storage locations (α-006)

`cover_objects(filename PRIMARY KEY, bucket, object_key)` records verified S3 objects. An absent location row means the filename remains in local `DATA_DIR/covers`. Existing edition/Want List cover references and `/covers/` routes are stable across migration. Database schema version is 5. See [S3 configuration and migration](s3.md).

`GET /api/issues/:id/owned-series` returns `{ items }` from saved collection data only. It groups owned issues by matching series title across runs (case-insensitive, trimmed, Unicode-normalized), sorts by start year, volume, and numeric issue, and returns one row per issue with `copy_count`. It prefers owned variant artwork. Read-only and wanted-only entries are excluded.

`GET /api/issues/:id/series-ratings` returns `{ max_issue, points: [{ number, rating }] }` from saved metadata and personal ratings only, restricted to the exact Metron series ID. The range includes read-only issues and retained local issue records. Positive numeric issue labels are charted; nonnumeric specials are omitted. The UI shows the section only with two or more points. No provider calls occur.

## Reading journal (schema 5)

`reading_log(id TEXT PRIMARY KEY, issue_id, edition_key, read_date, created_at)` references a saved issue/edition; each reading has its own UUID, even on the same date. Dates are validated calendar strings `YYYY-MM-DD` and never timezone-shifted. Existing read flags create no inferred history. Issue responses expose `reading_log_count` across all covers.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/api/reading-log?month=YYYY-MM` | Required calendar month; entries ordered date descending, then creation time/ID descending, with issue and selected-cover metadata. |
| GET | `/api/issues/:id/reading-log` | All dated entries for the issue across variants, newest first. |
| POST | `/api/issues/:id/reading-log` | `{ edition_key, log_date }`; adds a distinct entry and atomically marks read, without ownership. |
| DELETE | `/api/reading-log/:uuid` | Deletes only the entry; does not alter read status, ratings, or copies. |
| PATCH | `/api/issues/:id/read` | Existing `{ read, edition_key }`; optional `log_date` when true creates an entry in the same transaction. `remove_log_entries: true` when false deletes all entries across covers atomically with marking unread; omitted/false retains entries. |
| POST | `/api/entries` | Optional `log_date` is validated before provider/image requests and saved atomically with import and read status. |

The UI asks about journal removal before marking unread when entries exist. Rating alone does not create a log entry. The monthly view and saved-issue journal changes make no Metron calls. The issue log section appears after the chart and includes all editions.

Mark-as-read requests may additionally include `rating` (0.5–5 in half-star steps). When provided, the saved issue's read status, rating and optional `log_date` are committed together. Omitting `rating` preserves an existing score. Ratings cannot be submitted when marking unread. Unsaved-issue imports already support the same combined fields through `/api/entries`.

`series.series_type` is persisted as `{ id, name }` (null when unavailable) on issue metadata and lightweight Want List metadata as of α-056. The detail UI displays its name as Format. This is separate from the series run's `volume` and the issue/collected-book `number`. The offline `scripts/backfill-series-types.mjs` utility fills only missing values from retained detail-cache data, backs up SQLite before updates, and refuses incomplete or concurrently changed plans. No schema version bump is needed for this JSON metadata addition.

Search results now expose `series.series_type` for title badges. If the issue list omits it, DangerRoom first reuses stored issue/Want List types or retained issue-detail cache data for that series. Otherwise a single shared `/api/series/:id/` provider lookup per series is cached for 24 hours, using the existing request pacing and cooldown handling. No per-issue lookup is needed for badges. Types without a TPB/HC badge retain their existing title presentation.
