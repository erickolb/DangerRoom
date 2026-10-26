# Metron fields and α-001 storage choices

These are provisional MVP choices for review. Fields marked “Metron” are available through the detail page's **Deep Search on Metron** link, which opens the official issue page without making another API call. DangerRoom intentionally does not permanently mirror the full API response. The provider-detail cache temporarily contains that response for 24 hours, with expired rows pruned on subsequent cache writes.

Verified against the official [IssueReadSerializer and nested variant serializer](https://github.com/Metron-Project/metron/blob/master/api/v1_0/serializers/issue.py) and [API documentation](https://github.com/Metron-Project/metron/blob/master/api/README.md) on October 25, 2026. The implementation source is more precise than the prose docs: it returns `page`, and nested variants currently do not expose a variant ID or currency. Availability and completeness depend on the record.

| Available fields | α-001 treatment |
| --- | --- |
| Issue `id`, `number`, `alt_number`, `title`, `name` (issue/story titles) | Save locally. The series/year/number form the collection display name. |
| Publisher and imprint IDs/names | Save locally. |
| Series `id`, `name`, `volume`, `year_began`, `language` | Save locally for identification and edition disambiguation. |
| Series `sort_name`, `alt_names`, `series_type`, `genres` | Metron. |
| `cover_date`, `store_date` | Save locally. |
| `image` | Download the original supplied image for each selected edition; retain its source URL. |
| Variant `name`, `image`, `upc`, `sku`, `price` | Save the selected variant's exact values and original cover locally. Never substitute the standard cover's identifiers. |
| Standard issue `price`, `price_currency`, `upc`, `sku` | Save as standard-edition metadata when the standard cover is selected. |
| `isbn`, `page` (page count), `rating` (content rating) | Save locally. |
| `resource_url`, `modified` | Save locally for source navigation and provenance, alongside the local save timestamp. |
| `attribution` (`source`, `url`) | Preserve source attribution locally; descriptions are not imported or displayed in α-001. |
| `desc`, `desc_is_solicitation` | Metron; decide later whether local synopsis/solicitation matters. If imported later, render source attribution and comply with its license. |
| `credits` with creator IDs/names and role IDs/names | Metron; a candidate for later local capture (especially writer/artist/cover artist). |
| `arcs`, `characters`, `teams`, `universes`, `reprints` | Metron; related IDs/names are available, with expanded biographies/details via their separate endpoints. |
| `average_rating`, `rating_count` | Metron; community rating is distinct from content rating and read status. |
| `cv_id`, `gcd_id` | Metron; external Comic Vine / Grand Comics Database IDs. |
| `cover_hash` | Metron; perceptual matching hash. Local file deduplication uses our own SHA-256 hash of the actual image bytes. |
| `foc_date` | Metron; retailer final order cutoff, unnecessary for initial personal inventory. |

## Variant identity

The issue-detail response's nested variants contain `name`, `price`, `sku`, `upc`, and `image`; **no ID**. DangerRoom assigns a deterministic local edition key from the exact name + UPC + SKU + source image URL. The standard cover has the key `standard`. Keys are scoped to the parent Metron issue. They do not depend on response ordering. Saved edition metadata remains stable if Metron later edits a variant. If Metron changes the identifying fields, a later import can produce a distinct local edition; automatic merging is deferred.

Variant currency is not supplied in the nested serializer. DangerRoom displays “Currency not supplied” instead of assuming the standard cover's currency. A missing variant UPC/SKU is preserved as missing, rather than inheriting a different cover's identifiers. Base issue ISBN and bibliographic fields remain issue-level and are labeled separately.

Read status is one record per issue. Its selected edition is retained for the reading-list cover. Every owned copy has a separate UUID referencing its exact saved edition. Marking the same issue as read is idempotent; owning multiple copies never becomes a quantity field.

## Image resolution

Metron documents an `image` URL, not a separate high-resolution request parameter. DangerRoom downloads that supplied file without transformation, retaining all available resolution. Search and unsaved cover-picker previews reference provider images directly; saved collection and details reference only local cover files. Only selected editions are downloaded permanently.

## API limits and authentication

Use a token from Metron's account **API Tokens** section via `METRON_API_TOKEN` in the ignored `.env`. Token authentication uses `Authorization: Bearer …` on the server. Basic authentication is also supported through server environment variables `METRON_USERNAME` and `METRON_PASSWORD`, but tokens are preferred.

The official [best-practices guide](https://metron-project.github.io/blog/api-best-practices) describes 20 requests/minute and 5,000/day baseline limits. Actual server rate-limit headers govern cooldowns. [Metron's API-use guidance](https://metron-project.github.io/blog/commercial-api-use) encourages caching and requires individual accounts for multi-user applications. This MVP is a single-user local application.
