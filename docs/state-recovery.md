# Companion state recovery

DangerRoom **1.2.1** restores the shared mobile interface on Android and existing iOS **1.3.0** clients. Android Hardlight **1.3.1**, code **25**, also handles Bluetooth/USB keyboard and navigation changes without recreating either native activity. Its minimum server remains 1.2.0; update the server to 1.2.1 for shared recovery.

## What returns

- The active destination, submitted search, UPC (including leading zeros), applied filters, selected issue/edition, and list scroll position.
- Unsaved search/filter inputs, cover-picker selection, reading-date/rating choices, and slideshow-settings drafts. Reading dialogs reopen for review; nothing is submitted automatically.
- The selected slideshow cover, paused. If that cover is no longer eligible, show another eligible cover paused.
- Android's nonsecret connection hostname/device drafts and image-search hash distance. Device secrets are never copied into recovery storage. A capture interrupted by process death returns to a usable capture screen; an unfinished photograph or hashing operation is not recovered.

Recovery reloads current server data rather than restoring cached inventory or API responses. Deleted issues, changed variants, revoked credentials, and network failures follow normal error handling. Submitted writes are never queued or replayed. If a process dies while a request is in flight, check the fresh server state before repeating the action. Partial framed scanner input is discarded; the last completed barcode remains recoverable.

## Storage and performance

Each companion keeps a versioned snapshot in local web storage, scoped to its server/device. Android also changes the recovery scope when saved credentials change; iOS already isolates its web storage by server/device. Recovery expires after seven days and is capped at 32 KiB (up to 100 controls, 4,096 characters per field). Very large drafts may not be retained. Only the most recent destination is checkpointed. Clearing application/site data clears recovery. Ordinary browser sessions do not opt into companion recovery.

Inputs and scroll changes are debounced for 250 ms. Completed navigation, dialog state, slideshow cover changes, and lifecycle checkpoints save promptly. No cover bytes, scanner keystroke buffers, device secrets, or API response bodies are included. Storage failures do not block normal use. Abrupt termination can lose the last fraction of a second of edits; recovery is not a substitute for saving a record.

## Validation

Automated checks cover snapshot validation and isolation, expiry/size limits, draft restoration without events or writes, explicit deep links, stale renders, interrupted scanner frames, selected slideshow cover recovery, and successful submissions not being replayed. Run `node --test` and `node scripts/check.mjs`.

Run `node scripts/verify-recovery-browser.mjs` with Playwright installed. `PLAYWRIGHT_MODULE` can identify an existing Playwright entry point; `BETA_BROWSER_EXECUTABLE` can identify a browser executable. The test uses a temporary database and a mocked native bridge, not a live collection. It does not substitute for a physical Android/iOS lifecycle or Bluetooth test.

On the device, verify:

1. Connect/disconnect the scanner repeatedly in UPC Mode, results, collection, native settings, and Image Cover Search. There should be no splash screen or lost draft caused by activity recreation. Scan another barcode afterward.
2. Background the app, terminate its background process, and reopen. Verify destination, search/filter drafts, completed UPC, selected cover, and list position.
3. Repeat with an unsaved reading dialog; confirm its choices, then save once and verify one journal entry. Repeat after a successful save and confirm the dialog does not reopen.
4. Interrupt a framed scan; reopen and confirm no partial barcode is searched. Escape, blur, and scanner timeout must leave scanning usable.
5. Reopen during a slideshow. Confirm the selected eligible cover returns paused, then resume playback.
6. Change connection credentials and verify recovery does not carry into the new connection. Test a revoked credential and an unavailable server.
7. Recreate native settings and image search; recover nonsecret drafts/distance and safely restart an interrupted capture.
8. On iOS 1.3.0 with server 1.2.1, repeat shared recovery scenarios. No new IPA is required.
