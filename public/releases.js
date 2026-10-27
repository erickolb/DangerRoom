// Newest first; source for the app version and visible changelog.
export const releases = [{
  version: 'α-040', date: '2026-10-26', title: 'Manage your run',
  changes: ['Add collection, Want List, and read toggles to Owned Issues In Series tiles, sharing status with the current detail page.', 'Keep untoggled tiles available for restoring ownership and update their copy counts immediately.'],
}, {
  version: 'α-039', date: '2026-10-26', title: 'Dollars by default',
  changes: ['Display cover prices with $ when no currency is supplied.'],
}, {
  version: 'α-038', date: '2026-10-26', title: 'The rest of your run',
  changes: ['Add Owned Issues In Series beneath Owned Copies on comic details, ordered by series year, volume, and issue number.', 'Group owned issues across same-title series runs, with one linked tile per issue and a copy count; use owned variant artwork when available.'],
}, {
  version: 'α-037', date: '2026-10-26', title: 'Matching detail notes',
  changes: ['Style both detail instructions with the same small italic text and existing hint color.'],
}, {
  version: 'α-036', date: '2026-10-26', title: 'Series at a glance',
  changes: ['Add Publisher and Volume at the top of comic metadata, and show publisher, series name, and volume in the detail header.'],
}, {
  version: 'α-035', date: '2026-10-26', title: 'A quieter rating note',
  changes: ['Make the shared reading-status note below ratings much smaller, grey, and italic.'],
}, {
  version: 'α-034', date: '2026-10-26', title: 'A closer look',
  changes: ['Open saved full-resolution cover images in a responsive lightbox from comic details; close with Escape, the close button, or the backdrop.'],
}, {
  version: 'α-033', date: '2026-10-26', title: 'Another copy',
  changes: ['Use the supplied duplicate icon for adding another copy, removing embedded bottom text and retaining creator attribution.'],
}, {
  version: 'α-032', date: '2026-10-26', title: 'A quieter clear control',
  changes: ['Replace Clear rating with an accessible circled X beside the score, visible only for saved ratings.'],
}, {
  version: 'α-031', date: '2026-10-26', title: 'Click to rate',
  changes: ['Save detail and cover-picker ratings immediately when a half-star is clicked; remove Save rating and retain Clear rating.', 'Prevent overlapping saves and restore the saved score if a request fails.'],
}, {
  version: 'α-030', date: '2026-10-26', title: 'Two halves, one star',
  changes: ['Center star glyphs within their clipping boxes so half-stars align correctly.', 'Preview all half-stars up to the hovered or focused score in the detail rating editor.'],
}, {
  version: 'α-029', date: '2026-10-26', title: 'A simpler collection link',
  changes: ['Remove the arrow from the header My Collection button.'],
}, {
  version: 'α-028', date: '2026-10-26', title: 'Collection in the header',
  changes: ['Add the white boxes icon to the header My Collection button.'],
}, {
  version: 'α-027', date: '2026-10-26', title: 'One way to Metron',
  changes: ['Remove redundant Search Metron buttons from the Want List body, retaining the header link.'],
}, {
  version: 'α-026', date: '2026-10-26', title: 'A simpler Want List',
  changes: ['Remove the introductory sentence beneath the Want List heading.'],
}, {
  version: 'α-025', date: '2026-10-26', title: 'A shopping list for your pulls',
  changes: ['Update the Want List page heading to The Shopping List For Your Next Pulls.'],
}, {
  version: 'α-024', date: '2026-10-26', title: 'Your next pulls',
  changes: ['Refresh Want List empty-state wording and find-field placeholder, hiding the visible field label while retaining accessibility.'],
}, {
  version: 'α-023', date: '2026-10-26', title: 'Ready to launch discourse',
  changes: ['Update the Read and Rated Comics empty state with a new heading and an invitation to rate a comic.'],
}, {
  version: 'α-022', date: '2026-10-26', title: 'A tighter collection toolbar',
  changes: ['Hide the visible collection find-field label while preserving its accessible name, and reduce spacing below the mode buttons.'],
}, {
  version: 'α-021', date: '2026-10-26', title: 'An orderly shelf',
  changes: ['Hide standard-cover captions and show variant names in smaller italics on collection tiles.', 'Align ratings and action buttons along the bottom of each tile row, leaving spare space above the controls.'],
}, {
  version: 'α-020', date: '2026-10-26', title: 'Let the icons speak',
  changes: ['Remove redundant Read and Unread labels from collection tiles; reading status remains on the icon.'],
}, {
  version: 'α-019', date: '2026-10-26', title: 'In reading order',
  changes: ['Default collection views to series name, series start year, and numeric issue order, keeping covers and duplicate copies together.'],
}, {
  version: 'α-018', date: '2026-10-26', title: 'Rate from your shelf',
  changes: ['Rate collection tiles in half-star steps with grey unrated stars and hover preview.', 'Save ratings immediately across copies and variants, marking the issue read; five stars glow brighter.', 'Match collection Search Metron to the unselected tabs.'],
}, {
  version: 'α-017', date: '2026-10-26', title: 'An atom of navigation',
  changes: ['Use the Metron atom mark without lettering, black on collection search buttons and white in the header.', 'Move collection Search Metron alongside the collection tabs and remove its arrow.'],
}, {
  version: 'α-016', date: '2026-10-26', title: 'Search with Metron',
  changes: ['Add the official Metron logo in black to My Collection search buttons on a light background.'],
}, {
  version: 'α-015', date: '2026-10-26', title: 'Clean icon artwork',
  changes: ['Remove embedded text beneath the five Noun Project icons while preserving artwork, transparency, and creator credits.'],
}, {
  version: 'α-014', date: '2026-10-26', title: 'Collection and reading',
  changes: ['Rename collection tabs to My Collection and Read and Rated Comics, with supplied boxes and star icons and creator credits.'],
}, {
  version: 'α-013', date: '2026-10-26', title: 'Find here, search Metron',
  changes: ['Use Find for collection and curated-list lookups, and Search for Metron throughout navigation, forms, and guidance.'],
}, {
  version: 'α-012', date: '2026-10-26', title: 'Pull your next issue',
  changes: ['Update the homepage heading to Pull your next issue.'],
}, {
  version: 'α-011', date: '2026-10-26', title: 'Keep searching',
  changes: ['Carry collection search text into Metron search from the Search comics and Find a comic links.'],
}, {
  version: 'α-010', date: '2026-10-26', title: 'DangerRoom for everyone',
  changes: ['Use standalone DangerRoom branding throughout the header, footer, browser title, metadata, and documentation.'],
}, {
  version: 'α-009', date: '2026-10-26', title: 'Quiet copy labels',
  changes: ['Style tile copy identifiers as small, uppercase grey text.'],
}, {
  version: 'α-008', date: '2026-10-26', title: 'Your cover, your collection',
  changes: [
    'Show an owned variant cover in search results instead of the standard artwork.',
    'Prefer the most recently added owned variant when several covers are collected; fall back to an owned standard cover or Metron artwork.',
    'Reuse saved cover images from local storage or S3 without additional Metron lookups.',
  ],
}, {
  version: 'α-007', date: '2026-10-26', title: 'A spectrum of stories',
  changes: [
    'Highlight search tiles when any cover of an issue is owned, wanted, or read.',
    'Give active icons a consistent left-to-right coral, green, and violet glow.',
    'Keep the Want List cover picker available when another variant is already owned.',
  ],
}, {
  version: 'α-006', date: '2026-10-25', title: 'Covers in the cloud',
  changes: [
    'Support private AWS S3 image storage alongside local files, with stable cover URLs.',
    'Add a resumable migration command that verifies uploads before updating database locations.',
    'Document S3 configuration, scoped permissions, migration, and backups.',
  ],
}, {
  version: 'α-005', date: '2026-10-25', title: 'Status at a glance',
  changes: [
    'Use icon-only collection, Want List, and read toggles with green, amber, and purple active states.',
    'Save status changes immediately; untoggle collection to remove just that copy and toggle it back on to restore ownership.',
    'Keep separate duplicate-copy controls and an icon for adding another copy, with accessible labels and tooltips.',
    'Update shared read status across visible copies and variants without a page reload.',
  ],
}, {
  version: 'α-004', date: '2026-10-25', title: 'Find your next cover',
  changes: [
    'Add a cover-specific Want List with lightweight local metadata, saved cover images, and links to each comic on Metron.',
    'View, search, remove, and acquire wanted covers from their own screen.',
    'Acquiring an exact cover removes its want; already-owned covers have a quietly disabled want-list option.',
    'Add the shopping-list icon and creator credit.',
  ],
}, {
  version: 'α-003', date: '2026-10-25', title: 'Rate your reads',
  changes: [
    'Rate comics from half a star to five stars, in half-star steps, when adding them or from their details.',
    'Saving a rating automatically marks the issue as read and shares the rating across every copy and cover variant.',
    'Show personal ratings in Owned and Read collections; clear a rating without changing read status.',
  ],
}, {
  version: 'α-002', date: '2026-10-25', title: 'A new universe',
  changes: ['Change the default-page tagline to “Open up a whole new universe.”'],
}, {
  version: 'α-001', date: '2026-10-25', title: 'The collection begins',
  changes: [
    'Search Metron by series, issue number, series year, or UPC and choose the exact cover before saving.',
    'Keep ownership and read status independent, with a separate inventory entry for every owned copy.',
    'Browse owned comics or read history and search your saved collection without contacting Metron.',
    'Save essential metadata and original-resolution cover files locally; cache lookups and respect Metron rate limits.',
    'Add the default dark styling, supplied app and action icons, collapsible credits, and a footer-linked changelog.',
  ],
}];
