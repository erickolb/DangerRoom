# DangerRoom α-001 API and data model

All endpoints are local to DangerRoom. JSON mutations require `Content-Type: application/json`. Server binds to `127.0.0.1:4340` by default. Host checks and same-origin mutation checks protect the local listener; these do not replace login/access control for internet deployment.

| Method and path | Behavior |
| --- | --- |
| `GET /api/health` | Build label and whether Metron credentials are configured; no secret values. |
| `GET /api/search?q=Batman&number=1&year=2024&page=1` | Cached provider issue search. `year` means series start year. `upc` can be used without `q`. |
| `GET /api/metron/issues/:id` | Cached issue metadata and available cover selections. |
| `POST /api/entries` | `{issue_id, edition_key, owned: boolean, read: boolean}`; at least one flag true. Fetch authoritative metadata, validate exact edition, persist cover, then atomically save the entry/status. Every `owned:true` request intentionally adds another distinct copy. |
| `GET /api/collection?view=owned&q=…` | Local copy list, owned by default. Every copy is a separate item. `view=read` returns each read issue once. |
| `GET /api/issues/:id` | Local metadata, saved editions/covers, copies, and read record. No Metron call. |
| `PATCH /api/issues/:id/read` | `{read: boolean, edition_key}`. Mark read/unread independent of owned copies; a saved edition is required when setting true. |
| `DELETE /api/copies/:uuid` | Remove exactly one copy. Read status and other copies are preserved. UI confirms this action. |
| `GET /covers/:sha256.extension` | Locally stored cover. Only validated filenames and raster formats are served. |

## Tables

- `issues`: Metron issue ID, essential metadata JSON, first save timestamp.
- `editions`: composite `(issue_id,key)` identity, exact edition metadata JSON, optional cover filename. Only saved selections are persisted here.
- `copies`: UUID per owned copy, issue and edition references, added timestamp. No quantity column or uniqueness constraint on issue/edition.
- `reads`: one row per read issue, selected edition and original marked-read timestamp. No owned copy required.
- `cache`: expiring provider search/detail payloads. Removed expired rows on cache writes.
- `provider_state`: durable next-request and provider cooldown timestamps.

SQLite foreign keys enforce valid edition references. Mutations use prepared statements. A save transaction creates issue/edition and owned/read records together only after its cover downloads. Concurrent requests may create multiple intended copies, sharing the saved image. Copy deletion never triggers image deletion in this MVP.

Status errors use `{error}`. HTTP 429 includes `Retry-After`. Provider credentials never reach browser responses, URLs, or logs. Images are fetched without authorization headers, only from approved Metron HTTPS media hosts; redirects are refused.
