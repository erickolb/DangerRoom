// Newest first; source for the app version and visible changelog.
export const releases = [{
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
    'Add Chateau Lore styling, supplied app and action icons, collapsible credits, and a footer-linked changelog.',
  ],
}];
