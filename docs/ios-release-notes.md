# Hardlight 1.1.0 for iOS - Build 2

**Hardlight 1.1.0** adds scanner-driven UPC lookup mode. Requires DangerRoom **β-030 or later**.

- UPC Mode appears immediately after Search Metron in the menu; the search page also has a same-page barcode toggle.
- Keyboard/HID scanners can send STX (0x02, often Ctrl+B), barcode digits, then Enter. A new scan closes open dialogs and cancels unsaved prompts without reversing completed saves.
- More than 12 digits searches exactly; 12 or fewer uses Metron UPC prefix matching. Leading zeros are preserved.
- A unique exact UPC cover is preselected; exact matches receive a golden glow (static with reduced motion). Choose and confirm collection, Want List, or read actions.
- Collapsed, model-independent scanner setup tips cover supplements, prefix/suffix, and iOS keyboard access. This is external-scanner input, not camera recognition.

Update the server container using [the update guide](https://github.com/erickolb/DangerRoom/blob/main/docs/updating.md). The server remains in the beta line. Existing credentials, collection, and slideshow settings are retained.

iPhone/iPad, iOS 17+. Application ID `net.chateaulore.hardlight`; build **2**. Built on barovia.chateaulore.net. The IPA has a verified ad-hoc signature; import through LiveContainer or re-sign with SideStore for your device. This is not an App Store build. Includes DangerRoom.ipa and DangerRoom.ipa.sha256.

Validation: Node regression/browser workflow and Android checks passed. All three iOS simulator XCTest tests passed with the unchanged icon catalog excluded only in the isolated test build after an Xcode asset-tool stall. Release packaging includes the actual icon assets; physical scanner acceptance of the final integration remains recommended.
