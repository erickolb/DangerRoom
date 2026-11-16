# Metron data mapping

This reference describes how DangerRoom maps Metron responses into saved issue and edition records. The implementation is in [provider normalization](../src/metron.mjs) and [database persistence](../src/database.mjs). It intentionally retains selected metadata rather than permanently mirroring the full provider response.

In the table below, **Provider-only** means the field is not imported into saved inventory metadata. Users can follow **Deep Search on Metron** to view the official issue page without another API request from DangerRoom. Temporary provider-detail cache entries can contain the full response; they are distinct from saved collection records. See [Storage and API Use](../README.md#storage-and-api-use) for caching and request behavior.

Availability and completeness depend on the provider record. This document describes the current local mapping, not a guarantee about future Metron responses.

| Provider fields | Local treatment |
| --- | --- |
| Issue `id`, `number`, `alt_number`, `title`, `name` (issue/story titles) | Save locally. The series/year/number form the collection display name. |
| Publisher and imprint IDs/names | Save locally. |
| Series `id`, `name`, `volume`, `year_began`, `language` | Save locally for identification and edition disambiguation. |
| Series `series_type` (`id`, `name`) | Save locally for collection imports and lightweight wants; displayed as Format on details. Backfill older records from retained issue-detail cache where available. |
| Series `sort_name`, `alt_names`, `genres` | Provider-only. |
| `cover_date`, `store_date` | Save locally. |
| `image` | Download the original supplied image for each selected edition; retain its source URL. |
| Variant `name`, `image`, `upc`, `sku`, `price` | Save the selected variant's exact values and original cover locally. Never substitute the standard cover's identifiers. |
| Standard issue `price`, `price_currency`, `upc`, `sku` | Save as standard-edition metadata when the standard cover is selected. |
| `isbn`, `page` (page count), `rating` (content rating) | Save locally. |
| `resource_url`, `modified` | Save locally for source navigation and provenance, alongside the local save timestamp. |
| `attribution` (`source`, `url`) | Preserve source attribution locally; descriptions are not imported or displayed. |
| `desc`, `desc_is_solicitation` | Provider-only; synopsis and solicitation text are not imported or displayed. |
| `credits` with creator IDs/names and role IDs/names | Provider-only; creator and role records are not imported. |
| `arcs`, `characters`, `teams`, `universes`, `reprints` | Provider-only; related IDs/names are available, with expanded biographies/details via their separate endpoints. |
| `average_rating`, `rating_count` | Provider-only; community rating is distinct from content rating and read status. |
| `cv_id`, `gcd_id` | Provider-only; external Comic Vine / Grand Comics Database IDs. |
| `cover_hash` | Provider-only; perceptual matching hash. Local file deduplication uses our own SHA-256 hash of the actual image bytes. |
| `foc_date` | Provider-only; retailer final order cutoff, not imported into inventory. |

## Variant identity

The issue-detail response's nested variants contain `name`, `price`, `sku`, `upc`, and `image`; **no ID**. DangerRoom assigns a deterministic local edition key from the exact name + UPC + SKU + source image URL. The standard cover has the key `standard`. Keys are scoped to the parent Metron issue. They do not depend on response ordering. Saved edition metadata remains stable if Metron later edits a variant. If Metron changes the identifying fields, a later import can produce a distinct local edition; automatic merging is deferred.

Variant currency is not supplied in the nested serializer. DangerRoom displays “Currency not supplied” instead of assuming the standard cover's currency. A missing variant UPC/SKU is preserved as missing, rather than inheriting a different cover's identifiers. Base issue ISBN and bibliographic fields remain issue-level and are labeled separately.

Read status is one record per issue. Its selected edition is retained for the reading-list cover. Every owned copy has a separate UUID referencing its exact saved edition. Marking the same issue as read is idempotent; owning multiple copies never becomes a quantity field.

## Image resolution

Metron documents an `image` URL, not a separate high-resolution request parameter. DangerRoom downloads that supplied file without transformation, retaining all available resolution. Search and unsaved cover-picker previews reference provider images directly; saved collection and details reference only local cover files. Only selected editions are downloaded into persistent cover storage.

## Lightweight Want List records

The field table describes full saved inventory metadata. Want-only entries use a smaller allowlist: issue ID, display name and number; series ID, name, start year, volume and type; cover date; official resource URL; and the selected edition key, name, and source image URL. The wants table separately stores the local cover filename and addition timestamp.

Saving a want does not create inventory issue, edition, copy, read, or rating records. Acquiring that exact cover imports inventory metadata and removes the matching want in the same transaction. See [API and data model](api.md) for tables and request behavior.

## Provenance and attribution

Full saved issue metadata preserves the validated Metron resource URL, provider modification timestamp, and supplied attribution array. The issue record also has a local save timestamp. Selected edition records retain their source image URL. Provider modification time and local save time describe different events; saved metadata is not automatically synchronized with upstream edits.

Descriptions, creator credits, and other provider-only fields are not implicitly imported merely because the temporary cache contains them. Changes to this mapping should explicitly account for attribution and metadata licensing. See [licensing and third-party notices](../THIRD_PARTY_NOTICES.md).

## Fill missing comic formats in older records

Older collection and Want List records may lack Metron's series type, which supplies Format labels and TPB/HC/OMNI/GN badges. The backfill utility fills only missing `series_type` values from retained issue-detail cache entries (including expired entries still present) and types already saved on other issues in the same series. It never calls Metron or overwrites existing types.

Back up the instance first. For a source installation, stop the app, then run from its checkout:

```sh
pnpm run backfill:series-types --dry-run
pnpm run backfill:series-types
```

For a container installation, use the same checkout, Compose configuration, and data volume as the running app:

```sh
sudo docker compose stop dangerroom
sudo docker compose run --rm --no-deps dangerroom node scripts/backfill-series-types.mjs --dry-run
sudo docker compose run --rm --no-deps dangerroom node scripts/backfill-series-types.mjs
sudo docker compose up -d
```

Inspect the dry-run result before running the write command. If any series cannot be resolved, no records are updated; preserve or obtain the missing detail data before rerunning. The write command creates a consistent SQLite backup under `DATA_DIR/backups/` before updating issue and Want List JSON. It refuses a plan if relevant data has changed since planning. Rerunning after success makes no changes. Restart the source app afterward, or bring the container back up as shown. No schema version change is needed.

