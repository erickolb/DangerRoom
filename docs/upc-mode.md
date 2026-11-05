# UPC lookup mode (β-030 / Hardlight 1.1.0)

Hardlight 1.1.0 release preparation is authorized. Android and iOS use separate platform-labeled releases; the server remains in the beta line.

On Search Metron, the barcode button to the left of the search field switches to UPC-only entry in the current document. Toggle it off for title search. Hardlight's shared Android/iOS menu places **UPC Mode** immediately after **Search Metron** and opens the same search page with UPC mode active.

Keyboard-compatible USB/Bluetooth HID scanners can prefix scans with STX (0x02, commonly delivered as Ctrl+B) and terminate with Enter. The foreground document listens across fields and buttons. A prefix switches to UPC mode, closes open dialogs, cancels unsaved reading prompts, and invalidates pending search/detail rendering. It never reverses a save already sent to the server. Digits are buffered independently of focus; Enter submits once. An incomplete frame expires after two seconds of inactivity. Invalid/non-digit or overlength frames are rejected; ordinary typing without a prefix is left alone.

Barcodes are strings so leading zeros survive. More than 12 digits uses Metron's exact `upc` filter; 1–12 digits uses `upc_starts_with`. UPC mode sends only the barcode search, not title, issue/year, or prior result filters. No exact-to-partial fallback is attempted for a missing long barcode. A scan does not save or automatically select an action.

Tap collection, Want List or read on a result to open its cover picker. A unique exact edition UPC is preselected, and each exact match has a labeled animated golden outline. Partial-prefix matches do not select a cover unless there is only one edition. Ambiguous duplicate exact UPCs are highlighted without guessing a selection. Reduced-motion preferences keep the outline static. Confirm the cover and operation using the picker controls. Read still uses the existing date/rating confirmation. Scan the next comic to dismiss the picker and repeat.

## Scanner configuration

The collapsed tips are model-independent: use keyboard/HID mode, STX prefix, Enter suffix, preserve leading zeros/system/check digits, and enable UPC/EAN supplements for extended comic barcodes. Some hardware requires the supplement when enabled; turn supplements off for main-only scans if needed. Configure an iOS software-keyboard shortcut if your model provides one. The app cannot receive scans sent to another application, browser address bar or system dialog.

Reference diagnostic results and printable controls: https://github.com/erickolb/upc-scanner-diagnostics

## Acceptance testing before release

- Web, Android and iOS: menu/toggle, manually entered short/12/17-digit codes, STX and Ctrl+B, leading zeros, Enter, repeated scans, no-match and provider errors.
- Scan with a text field or button focused, and while a cover picker, reading confirmation or cover lightbox is open. No stray text/button activation or unintended save.
- Unique exact variant preselection and golden highlight; no false highlight for a 12-digit prefix; no guessing when catalog UPCs are duplicated or absent.
- Confirm collection, Want List and read against the selected variant, then scan another comic, including during delayed provider/detail responses.
- Normal title search, collection, Want List, reading log and device settings still work. Scanner tips start collapsed. Mobile controls fit narrow screens and reduced motion disables animation.

Use Barovia for iOS builds/tests. Android versionName and iOS marketing version are staged at 1.1.0. Existing published installation guides/downloads remain at 1.0.2 until release approval. Server container update instructions remain in [updating.md](updating.md).

Metron filter reference: https://github.com/Metron-Project/metron/blob/master/api/README.md

## Automated verification

`node --test` covers the scanner state machine (framing, ordinary typing, timeout, invalid payload rejection, repeated scans and Enter release), exact/partial filter selection and unambiguous edition matching, alongside the existing server/device/inventory tests.

`node scripts/verify-upc-browser.mjs` exercises a disposable local fixture database in a real browser, including manual mode switching without document navigation, partial/exact requests, exact variant highlighting/preselection, Want/collection/read saves, read cancellation on scanning, and stale-detail suppression. It requires Playwright in the environment. Optionally set `PLAYWRIGHT_MODULE` to its installed module path and `UPC_BROWSER_EXECUTABLE` to a Chromium-family executable. It writes screenshots under `.work/upc-ui/`; it does not use real credentials or collection data.

Initial automated checks: 88 Node tests and Android debug assembly/unit/lint checks passed. Browser workflow passed at desktop and narrow-screen sizes. Physical acceptance testing of this DangerRoom integration remains required; diagnostic-tool hardware results alone do not establish that all real-app flows work.

Barovia iOS simulator: all 3 XCTest tests passed, including the six-item shared menu and UPC shortcut. The initial normal test build stalled in Xcode's unchanged asset-catalog compilation. The successful isolated debug test used `EXCLUDED_SOURCE_FILE_NAMES=Assets.xcassets ASSETCATALOG_COMPILER_APPICON_NAME=` to bypass that tool stall; no such exclusion was added to repository build settings. This verifies the shared menu/WebView/native API path, not a full icon-bearing release build. No device IPA, release tag, or published release was produced for this feature.
