# Changelog

## α-004 · 2026-10-25

- Add an exact-cover Want List with lightweight local metadata and cover files, separate from inventory.
- Browse/search wanted covers, open their Metron pages, remove wants, or add the selected cover to the collection.
- Acquiring a cover cancels its want atomically; already-owned covers quietly disable the want-list action.
- Include the shopping-list icon and attribution to Atif Arshad / Noun Project (CC BY 3.0).


## α-003 · 2026-10-25

- Add personal five-star ratings with half-star increments on comic intake and details, displayed throughout the collection.
- Saving a rating marks the issue read and shares the score across all owned copies and variants.
- Clear a rating without clearing read status; preserve existing inventory through an automatic database migration.


## α-002 · 2026-10-25

- Change the default-page tagline to “Open up a whole new universe.”

## α-001 · 2026-10-25

- Prominent Metron search with issue, series year, UPC, and pagination.
- Explicit cover selection with exact variant metadata and local original-resolution cover files.
- Independent ownership and read status; one inventory entry per owned copy, including duplicates.
- Owned and Read collection views, local search, issue details, and Deep Search on Metron.
- Cached and paced provider requests with persistent rate-limit cooldowns.
- Chateau Lore visual defaults, supplied icons and attributions, footer Credits, and an in-app changelog driven by `public/releases.js`.
