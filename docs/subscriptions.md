# Subscriptions

Subscriptions follow a specific Metron series, independently of individual issues, collection copies, reading status, and wanted covers. Use the books button on a comic to subscribe or unsubscribe immediately, without a confirmation window. Every displayed comic in that series shares the same subscription status.

Open **Subscriptions** from the web navigation:

- **Releasing This Week** includes store release dates from Sunday through Saturday of the current week, using your browser's local date.
- **Upcoming Releases** includes store release dates after that Saturday.
- **Missing Issues** includes store release dates before that Sunday, excluding issues where you own any cover. A read or rated issue outside the collection can still be missing.
- **Subscription List** lists subscribed series alphabetically. Each thumbnail represents the next release on or after today, or the most recent release if none is upcoming. Use **×** to unsubscribe and remove the series from the list.

Date views show one card per issue. If you want a variant, the earliest-added wanted variant takes precedence; otherwise the standard cover is used. Multiple wanted variants are resolved by their addition time, with insertion order breaking ties. Subscription List thumbnails also prefer collected variants when no variant is wanted, matching the existing collection artwork preference.

Issues without a store date are excluded from date views. Collection and Want List actions do not change subscriptions. Subscribing does not add issues to either list.

Results load progressively from Metron, using cached pages for six hours. Date views request only their relevant date range. If a provider request fails or reaches its quota, loaded results remain usable, including unsubscribe controls. Loading stops without automatic retries. Reopen the view to try again; completed pages can be reused.

## Preview scope

DangerRoom 1.2.0 is a web UX preview on the preparation branch. Hardlight Android and iOS remain at their published 1.2.0 versions. Native menu integration and Android beta testing follow approval of the web experience. No client build or stable release is part of this preview.

The database upgrade adds a separate subscriptions table without rewriting collection, Want List, or reading records. Back up the database before updating; follow the [general update and rollback guide](updating.md).
