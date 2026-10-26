# Changelog

## α-009 · 2026-10-26

- Make comic tile copy identifiers small, uppercase, and grey.

## α-008 · 2026-10-26

- Show saved owned variant artwork in search tiles, preferring the latest owned variant over the standard cover.
- Fall back to an owned standard image or provider artwork when no owned variant image remains.

## α-007 · 2026-10-26

- Aggregate search tile ownership and wants across all variants, alongside issue-level read status.
- Add consistent coral, green, and violet active glows from left to right.
- Keep search Want List controls available when another cover is owned.


## α-006 — 2026-10-25

- Add private S3 cover storage with per-image database locations and unchanged cover URLs.
- Add verified, resumable local-to-S3 migration and deployment configuration documentation.

## α-005 · 2026-10-25

- Replace collection, Want List, and read action text with icon-only toggles, using green, amber, and purple for active status.
- Save toggles immediately; untoggle ownership to remove one copy, then re-toggle to restore it without a delete button or dialog.
- Preserve distinct copy controls, add another copy with a plus-marked icon, and synchronize shared read state across visible copies.
- Keep tooltips, accessible names, pressed states, keyboard access, and local metadata reuse.


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
