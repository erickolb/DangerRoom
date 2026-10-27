# Changelog

## α-035 · 2026-10-26

- Make the note about ratings marking copies and variants read smaller, grey, and italic.

## α-034 · 2026-10-26

- Open detail cover images in an accessible, responsive lightbox using the saved original-resolution file.
- Support closing with Escape, a close button, or the backdrop.

## α-033 · 2026-10-26

- Use the supplied duplicate icon for adding another copy, with bottom text removed and creator credit retained.

## α-032 · 2026-10-26

- Replace Clear rating with a circled X beside the score, shown only for saved ratings.

## α-031 · 2026-10-26

- Remove Save rating; clicking detail or cover-picker stars immediately saves the score.
- Keep Clear rating, prevent overlapping requests, and restore the saved score on failure.

## α-030 · 2026-10-26

- Center clipped star glyphs so both halves align correctly in rating controls.
- Preview the full hovered or focused score in the detail rating editor.

## α-029 · 2026-10-26

- Remove the arrow from My Collection in the header.

## α-028 · 2026-10-26

- Add the existing boxes icon, inverted to white, to My Collection in the header.

## α-027 · 2026-10-26

- Remove redundant Want List body Search Metron buttons; keep the header link.

## α-026 · 2026-10-26

- Remove the introductory sentence beneath the Want List heading.

## α-025 · 2026-10-26

- Change the Want List page heading to The Shopping List For Your Next Pulls.

## α-024 · 2026-10-26

- Update the Want List empty state to Your Next Pulls and Which issue will you pull next?
- Hide the visible find label and clarify the Want List field placeholder.

## α-023 · 2026-10-26

- Update the Read and Rated Comics empty-state heading and add the requested comic-rating encouragement.

## α-022 · 2026-10-26

- Hide the visible collection find label and tighten spacing below the mode buttons, retaining an accessible field name.

## α-021 · 2026-10-26

- Hide standard cover captions and style variant names as smaller italic text on collection tiles.
- Align ratings and buttons at the bottom of each row, placing spare space above them.

## α-020 · 2026-10-26

- Remove redundant Read/Unread badges from collection tiles while retaining reading status icons.

## α-019 · 2026-10-26

- Sort collection views by series name, start year, and numeric issue number, grouping variants and duplicate copies.

## α-018 · 2026-10-26

- Add immediate half-star ratings to collection tiles with grey unrated stars, hover/focus preview, and brighter five-star glow.
- Match Search Metron styling to unselected collection tabs.

## α-017 · 2026-10-26

- Use only the Metron atom mark, black in collection buttons and white in the header.
- Align collection Search Metron with the two collection tabs and remove its arrow.

## α-016 · 2026-10-26

- Add the official black Metron logo to collection-page Search Metron buttons, using a light button background for contrast.

## α-015 · 2026-10-26

- Clear the embedded text strip below all five Noun Project icons without altering the artwork or canvas.
- Preserve creator attributions and document the image modifications.

## α-014 · 2026-10-26

- Rename the collection tabs to My Collection and Read and Rated Comics.
- Add the supplied boxes and star icons with creator credits in the app and README.

## α-013 · 2026-10-26

- Reserve Find for local collection/list lookups and Search for Metron in interface labels and guidance.

## α-012 · 2026-10-26

- Change the homepage heading to “Pull your next issue”.

## α-011 · 2026-10-26

- Preserve collection search text when following Search comics or Find a comic into Metron search.

## α-010 · 2026-10-26

- Use standalone DangerRoom branding in the app, page metadata, documentation, and release history.

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
- Dark visual defaults, supplied icons and attributions, footer Credits, and an in-app changelog driven by `public/releases.js`.
