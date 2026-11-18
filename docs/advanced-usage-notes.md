# Advanced usage notes

This document captures detailed and nuanced information about use of the site that might not be intuitive or self-evident. Start with the [README](../README.md) for an overview and setup. These notes describe current behavior, including the reading controls that are planned for review in a future update. The shared application screens provide this behavior in the browser and both Hardlight clients.

## Issues, covers, and individual copies

Ownership tracks each physical copy of a selected cover. Want List entries track an exact cover. Read status and personal ratings belong to the issue and are shared across its covers and copies.

In the cover picker, toggling collection or Want List controls saves immediately; there is no separate Save button. Search results summarize status across all covers, while the picker lets you act on an exact cover. Search artwork prefers an owned variant (the most recently added when several are owned), then an owned standard cover, then Metron artwork.

Use **Add another copy** to record another copy of the same cover. Turning off a copy's collection control removes only that copy, without confirmation. Other copies, variants, ratings, and reading history remain intact. The inactive card stays available until navigation or refresh so you can toggle ownership back on. Doing so creates a new copy ID and addition date; it reuses saved metadata and artwork when available.

## Collection views and sorting

**My Collection** shows individual owned copies. **Read and Rated Comics** lists each read issue once, including issues you own and issues you do not. Local Find searches include series, publisher, issue, cover name, UPC, and ISBN; Search queries Metron instead.

**Alphabetical (Series)** is the default sort, using series name, start year, and numeric issue number, with variants and duplicate copies together. **Recently Added** orders copy additions newest first; the read view uses the marked-read date. Sorting stays selected when searching or switching collection tabs.

## Ratings and read status

Ratings use half-star steps from 0.5 to 5. Hover or focus previews a score; clicking saves it immediately. The score is shared across all copies and variants and is separate from Metron's content rating.

Saving a rating also marks the issue read, without adding ownership or a Reading Log entry. Adding another copy preserves an existing rating unless you explicitly choose a new score. **Clear rating** removes the score but keeps read status. Marking unread keeps the rating; saving a rating again marks the issue read.

## Reading Log and repeated readings

The Reading Log is a dated journal, distinct from the issue's read/unread flag. It shows newest dates first, by calendar month. Repeated readings, even on the same date, remain separate entries. Removing an entry does not change ownership, ratings, or read status.

The current **Mark As Read** dialog always shows a calendar, initially set to today on your device. **Record in Reading Log** defaults off. Selecting a day turns recording on; browsing months does not. An optional rating, read status, and selected reading date are saved together with **OK**. Cancel or Escape saves nothing. Dates remain calendar dates without UTC conversion.

Both lit and unlit read buttons open the same dialog. **Mark as read** defaults on regardless of current status. Turn it off to mark unread; journal recording and the calendar become disabled, and **Preserve reading journal entries** appears, enabled by default. Turn preservation off to remove all readings across covers. Cancel leaves everything unchanged. Ratings remain intact.

On comic details, **Log a Reading** records an additional reading and marks the issue read without adding ownership. **Reading Log Entries** includes entries across every cover, with individual removal controls. Existing read flags were not converted into historical journal dates when the feature was introduced.

## Want List interactions

You can own a standard cover and want a variant. Acquiring a wanted cover removes only that exact want. An already-owned cover cannot also be wanted; reading or rating an issue does not remove its wants. Duplicate wants become one list entry. Removing an owned copy does not restore a previous want.

An inactive Want List card remains until navigation or refresh so it can be toggled back on. Its cover/title opens the official Metron issue page rather than a local detail page. Wants are stored locally and do not modify Metron's wish list.

## Metron search filters

**Filters** supports series types and exact series names. Multiple choices within either group are combined as alternatives; the two groups and **Hide owned** narrow the results together. Hide owned excludes issues owned in any variant. **Clear** resets type and name selections; hide-owned is a separate control.

Filtering operates on the current page of Metron results. The total remains Metron's unfiltered match count, so a page may show no matching items while later pages still contain matches. Pagination remains available. Selections persist in the URL through pagination and new searches.

Series-name options come from the current results page, with selected names retained across pages. A selected title includes all runs with that exact name. The type catalog is fetched when opening the dropdown and cached for 24 hours; if unavailable, types found on the current page remain selectable.

## Comic details, formats, and series

Click a saved cover on its details page for a full-resolution lightbox; Escape, the close button, or clicking outside closes it. Resolution depends on the original image supplied by Metron.

**Owned Issues In Series** groups owned issues with the same series title across years and volumes, ordered by year, volume, and numeric issue. Each issue appears once with a copy count; links prefer owned variant artwork. **Search Full Series on Metron** performs a remote search by series name.

**Ratings In This Series** uses the exact Metron series run, rather than combining runs by title. It appears with at least two rated issues. It includes locally saved read-only issues, charts positive numeric issue numbers, and omits nonnumeric labels. Dotted lines indicate missing ratings. The range ends at the highest locally saved issue; it does not claim to show the complete published run. The owned-series shelf and ratings chart make no Metron requests.

Format badges TPB, HC, OMNI, and GN mean Trade Paperback, Hardcover, Omnibus, and Graphic Novel. Format is separate from series volume and issue number. GN badges replace a trailing GN suffix only in display; stored names are unchanged.

**Refresh Data from Metron** fetches fresh metadata and downloads saved-cover artwork again. Copies, ratings, reading logs, and slideshow exclusions are preserved. If a saved variant cannot be matched or an image download fails, the saved comic remains unchanged. This action makes remote requests, unlike ordinary browsing of saved comics.
