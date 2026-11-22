# Subscriptions

Subscriptions follow a specific Metron series, independently of individual issues, collection copies, reading status, and wanted covers. Use the books button on a comic to subscribe or unsubscribe immediately, without a confirmation window. Every displayed comic in that series shares the same subscription status.

Open **Subscriptions** from the web navigation or the Hardlight menu:

- **Releasing This Week** includes store release dates from Sunday through Saturday of the current week, using your browser's local date.
- **Upcoming Releases** includes store release dates after that Saturday.
- **Missing Issues** includes store release dates before that Sunday, excluding issues where you own any cover. A read or rated issue outside the collection can still be missing.
- **Subscription List** lists subscribed series alphabetically. Each thumbnail represents the next release on or after today, or the most recent release if none is upcoming. Use **×** to unsubscribe and remove the series from the list.

Date views show one card per issue. If you want a variant, the earliest-added wanted variant takes precedence; otherwise the standard cover is used. Multiple wanted variants are resolved by their addition time, with insertion order breaking ties. Subscription List thumbnails also prefer collected variants when no variant is wanted, matching the existing collection artwork preference.

Issues without a store date are excluded from date views. Collection and Want List actions do not change subscriptions. Subscribing does not add issues to either list.

Results load progressively from Metron, using cached pages for six hours. Date views request only their relevant date range. If a provider request fails or reaches its quota, loaded results remain usable, including unsubscribe controls. Loading stops without automatic retries. Reopen the view to try again; completed pages can be reused.

## Client availability

DangerRoom **1.2.0** provides subscriptions for the web and Hardlight **1.3.0** on Android (code **24**) and iOS (build **4**). Both clients require server **1.2.0** for the new endpoints. Update the instance before using these clients. Existing Hardlight 1.2.0 clients retain their previous menu until upgraded.

The database upgrade adds a separate subscriptions table without rewriting collection, Want List, or reading records. Back up the database before updating; follow the [general update and rollback guide](updating.md).
