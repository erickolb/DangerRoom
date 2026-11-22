# Danger Room
Danger Room is a self-hosted web application for comic book collection. It builds on the open API to use data from [Metron](https://metron.cloud) to seed entries in your instance of Danger Room, but the instance is under your control. This puts you in control of a platform to build features that suit you best.

Features currently supported:
+ Search the [Metron.cloud](https://metron.cloud) database.
  + Keyword search
  + [UPC search (12- and 17-digits)](docs/upc-mode.md)
+ Add comics to My Collection
+ Attach ratings (5-stars in half-star increments) to comics
+ Keep a Want List of comics to pull
+ Track the read/unread status of any comic
+ Maintain a dated reading journal
+ [Android](docs/hardlight-for-mobile.md#android) and [iOS](docs/hardlight-for-mobile.md#ios) companion app "HardLight"
  + [Search by UPC](docs/upc-mode.md) with a Bluetooth-connected device
  + [Cover image search](https://erickolb.github.io/DangerRoom/hardlight/cover-image-search/) on Android and iOS (capture, crop, rotation, and hash-distance search)
  + Slideshow of covers in your collection

[DangerRoom website](https://erickolb.github.io/DangerRoom/) · [Hardlight download and setup](https://erickolb.github.io/DangerRoom/hardlight/) · [Privacy policy](https://erickolb.github.io/DangerRoom/privacy/)

## Hardlight (Android / iOS Companion App)
The stable Android and iOS companions, code named Hardlight, have a seven-option menu plus configuration:
1. Want List
2. My Collection
3. Search Metron
4. UPC Mode
5. Cover Slideshow
6. Reading Log
7. Image Cover Search

Client is configurable for your Danger Room instance and allow-listed device credentials, seven-section menu. Cover slideshow features a local six-month artwork cache, a configurable 300 MB cache limit, and a flush cache button in addition to controls inactivity timeout (default 10 seconds, minimum 3) and independent title display duration (0 disables, full rotation duration keeps titles visible). The main menu’s reload button refreshes server code without exiting Hardlight.

The Hardlight client is deployed through [Obtainium](https://obtainium.imranr.dev/) for Android and [LiveContainer + SideStore](https://livecontainer.github.io/docs/installation/lc_sidestore) for iOS. The app is not available on commercial app stores. See [Hardlight download and setup](https://erickolb.github.io/DangerRoom/hardlight/) for further instructions.

# Instructions and Use Notes

## Run Locally
An instance of the Danger Room application is a web application that is meant to be hosted on a private network or tailnet to serve a single comic collection. There is no user account or authentication, so being able to access the web application presumes the viewer is authorized to both view and make changes in it. Android and iOS clients require a server-issued device ID and secret; credentials can be revoked on the server. See [migrating to a server](docs/migrating-to-a-server.md), [container updates and rollback](docs/updating.md), and [device token management](docs/mobile-device-token-management.md) for more information.

Requires Node.js 24 or later. Install dependencies with `pnpm install --frozen-lockfile`; no frontend build is needed.

1. The ignored `.env` file is prepared locally. On another checkout, copy `.env.example` to `.env`.
2. Sign in at [Metron](https://metron.cloud), open your account page, and find **API Tokens**. Create a token named **DangerRoom**.
3. Put that token after `METRON_API_TOKEN=` in `.env`. Keep it private; do not paste it into chat or commit it.
4. Run:

```sh
pnpm start
```

Open http://127.0.0.1:4340. Restart the process after changing `.env`. Without a token the app opens and saved collection pages work, but uncached Metron searches do not. `HOST`, `PORT`, `DATA_DIR`, and optional `ALLOWED_HOSTS` are documented in `.env.example`.

Each DangerRoom instance holds a single shared collection. Browser access retains the original trust model, with no sign-in.

## Run In a Container

Install Docker Engine and the Docker Compose v2 plugin. The container includes Node.js and the application dependencies, so you do not need to install them on the host. From a fresh checkout on your Linux server:

```sh
git clone https://github.com/erickolb/DangerRoom.git
cd DangerRoom
cp .env.example .env
chmod 600 .env
vi .env
```

Set `METRON_API_TOKEN` using the [Setup](#setup) instructions below. For access through a hostname, include that hostname in `ALLOWED_HOSTS` (without a scheme, path, or port). Set `DANGERROOM_URL` to the address you will use to reach the app. Then build and start it:

```sh
sudo docker compose build --pull
sudo docker compose up -d
sudo docker compose ps
curl --fail http://127.0.0.1:4340/api/health
```

The default configuration makes the app available at http://127.0.0.1:4340 on the Docker host. It binds to loopback only; access from another computer requires an SSH tunnel or a reverse proxy. Keep browser access on a private network or tailnet with appropriate access control: anyone who can reach the web app can change the shared collection. Hardlight requires an HTTPS address and its own device credentials.

SQLite and locally stored covers persist in the named `dangerroom-data` volume, mounted at `/data`. This does not automatically import an existing local `data/` directory. Preserve the volume and `.env` across updates; do not use `sudo docker compose down -v` unless you intend to delete the collection volume.

See [migrating to a server](docs/migrating-to-a-server.md) for HTTPS, device setup, and importing an existing collection, and [container updates, backups, and rollback](docs/updating.md) before updating a running instance. Optional cover storage in S3 is covered in [S3 configuration](docs/aws-s3-setup.md).

## Setup

Once the application is up and running, you will need to create an account at [Metron](https://metron.cloud). Creating an API key is required to be able to use the open API.

1. Sign in and go to Account.
2. Click on the API Tokens button in the top right.
3. Enter in the name of your API token (generally the hostname of the instance you're operating), and click Generate Token.
4. Enter the API token provided into your `.env` file.
5. Restart the app to load the updated `.env`: stop the local process and run `pnpm start` again, or run `sudo docker compose up -d --force-recreate` from the container checkout. A container restart alone does not reload environment values from `.env`.

## Using Danger Room

Search matches display before optional series-type lookups. Badges and filter options update in place as types arrive. Unknown types remain visible and labeled, including under a selected type filter. Enrichment stops at the quota limit, on a lookup error, or when you leave the page; it never retries automatically. Successful lookups are cached for 24 hours, so a later search can reuse them and fill remaining gaps.

The default page centers the comic search function. Searching uses your [Metron](https://metron.cloud) API key to execute the search and then display results. Application functions such as adding a comic to your collection, adding a comic to your want list, or marking the comic as read captures a copy of the cover image and metadata to your local application instance. Queries against the remote system are cached. Diagnostics about the interaction of your Danger Room instance and [Metron](https://metron.cloud) can be accessed from the app's footer.

Whenever adding a comic to your collection or your want list, a modal window opens to confirm which cover variant should be used. Image displays in the app will use the selected variant instead of the standard cover once added. It is possible to have duplicate copies of an individual issue in your collection; go to the comic detail screen and click the "Add another copy" button.

The read icon lights up when an issue is marked read. Clicking either state opens the same dialog: Mark as read defaults on, recording a journal entry defaults off, and choosing a calendar date enables recording. Turning read off disables recording and offers Preserve reading journal entries, on by default. Ratings remain unchanged when marking unread.

The **My Collection** section recalls comics that you have interacted with. The default view presented are comics indicated in your collection. Read and Rated Comics is an alternate view to recall comics you have marked as read or rated but are not in your personal collection (e.g. borrowed from a library). Unread Comics is an alternate view to filter your own collection down to those comics which are not marked as read or rate, behaving as a To-Be-Read list.

The **Want List** allows the user to create a shopping or "pull" list of comics to hunt for at your friendly local comic shop. Similar to adding comics to your collection, choice of cover variant matters. There are no integrations for your pull list with remote systems at this time.

The **Reading Log** section will be updated in a future update.

Clicking on a comic thumbnail or title in its listing from the My Collection screen calls up the comic detail page. This will display the cover image and metadata captured from [Metron](https://metron.cloud) when it was added. Buttons on the page allow you to either search the full series on Metron as well as refresh the local comic data from the remote source. The details page also shows your Reading Log entries for this comic and charts out the ratings you've supplied for all comics in the current series.

For detailed behavior around copies, variants, ratings, reading history, and search filters, see [Advanced usage notes](docs/advanced-usage-notes.md). For development checks and release maintenance, see [Contributing](CONTRIBUTING.md).

## Storage and API Use

- `data/dangerroom.sqlite`: issues, selected editions, individual copies, reading records, personal ratings, want-list records, lookup cache, and provider cooldown state.
- `data/covers/`: original supplied image bytes, without thumbnail substitution, resizing, or recompression; SHA-256 filenames reuse identical files. Resolution depends on the image [Metron](https://metron.cloud) actually supplies; no separate higher-resolution endpoint is documented. Covers are limited to 25 MB and validated as JPEG, PNG, WebP, or GIF.
- A new cover must download successfully before the entry is saved. If [Metron](https://metron.cloud) has no cover, the entry can be saved with an explicit unavailable-cover placeholder.
- Search caches last 6 hours; issue-detail caches last 24 hours. Concurrent identical lookups share one request. Persistent saved metadata and covers are used for collection browsing with no [Metron](https://metron.cloud) calls.
- Provider requests are serialized and paced at 3.1 seconds. Exhausted rate-limit headers and `Retry-After` persist a cooldown rather than repeatedly calling [Metron](https://metron.cloud). There is no crawling or background synchronization.
- [Metron](https://metron.cloud) credentials are server-only. DangerRoom uses only [Metron](https://metron.cloud) GET endpoints and does not modify your [Metron](https://metron.cloud) collection.
- Optional private AWS S3 cover storage and a resumable local-to-S3 migration are documented in [S3 configuration](docs/aws-s3-setup.md). SQLite stays local. Back up the database, local covers, S3 objects, and configuration together; covers are deliberately retained after copy removal.

See [Metron data mapping](docs/metron-data-mapping.md) and [API and data model](docs/api.md).


## Credits

- Image Search by Muhammad Adam from <a href="https://thenounproject.com/browse/icons/term/image-search/" target="_blank" title="Image Search Icons">Noun Project</a> (CC BY 3.0). `public/image-search.png` uses the supplied black icon; only the embedded bottom-left credit text is cleared. Original artwork pixels, dimensions, and transparency are preserved. Menu CSS inverts it for dark backgrounds.

- `public/black-bag.png` is the original generated black-bag design; `public/black-bag.svg` is the clean vector adaptation used in small controls.
- Slideshow by Sentya Irma from <a href="https://thenounproject.com/browse/icons/term/slideshow/" target="_blank" rel="noopener noreferrer" title="Slideshow Icons">Noun Project</a> (CC BY 3.0). `public/slideshow.png` is the Cover Slideshow menu icon; its embedded bottom-left credit text is removed.
- manual guide by Idad Muchlisin Ro Is from <a href="https://thenounproject.com/browse/icons/term/manual-guide/" target="_blank" rel="noopener noreferrer" title="manual guide Icons">Noun Project</a> (CC BY 3.0). `public/reading-log.png` is the Reading Log icon; its bottom text strip is cleared.
- duplicate by Yafet bouchagra from <a href="https://thenounproject.com/browse/icons/term/duplicate/" target="_blank" rel="noopener noreferrer" title="duplicate Icons">Noun Project</a> (CC BY 3.0). `public/duplicate.png` is the add-another-copy icon.
- Metron logo: [The Metron Project](https://github.com/Metron-Project/metron/blob/master/static/site/img/metron.svg); atom mark extracted without lettering, used on collection search buttons and in the header.
- boxes by Pictogramma from <a href="https://thenounproject.com/browse/icons/term/boxes/" target="_blank" rel="noopener noreferrer" title="boxes Icons">Noun Project</a> (CC BY 3.0). `public/boxes.png` is the My Collection tab icon.
- Star by MihiMihi from <a href="https://thenounproject.com/browse/icons/term/star/" target="_blank" rel="noopener noreferrer" title="Star Icons">Noun Project</a> (CC BY 3.0). `public/star.png` is the Read and Rated Comics tab icon.
- <a href="https://www.flaticon.com/free-icons/hero" title="hero icons">Hero icons created by Magnific - Flaticon</a>. `public/mask.png` is the header icon and favicon.
- box add by Epic Icon Designs from <a href="https://thenounproject.com/browse/icons/term/box-add/" target="_blank" rel="noopener noreferrer" title="box add Icons">Noun Project</a> (CC BY 3.0). `public/box-add.png` is the ownership/add action icon.
- Book check by Ardiansyah from <a href="https://thenounproject.com/browse/icons/term/book-check/" target="_blank" rel="noopener noreferrer" title="Book check Icons">Noun Project</a> (CC BY 3.0). `public/book-check.png` is the read action icon.
- shopping list by Atif Arshad from <a href="https://thenounproject.com/browse/icons/term/shopping-list/" target="_blank" rel="noopener noreferrer" title="shopping list Icons">Noun Project</a> (CC BY 3.0). `public/shopping-list.png` is the Want List icon.
- [CC BY 3.0 license](https://creativecommons.org/licenses/by/3.0/). The seven Noun Project icons have their embedded attribution text removed from the bottom margin; creator credits and license links are retained here and in the app. Icon artwork and canvas sizes are unchanged. CSS inverts the icons for contrast on dark controls.
- Comic metadata and images: [Metron](https://metron.cloud). Cover artwork belongs to its respective rights holders.

These credits also appear in the footer's collapsed **Credits** section. The visual defaults use deep wine surfaces, scarlet accents, warm text, Georgia headings, system body text, rounded panels, and responsive controls.

## Releases
Current Server Build: version 1.1.2

Stable Hardlight: [Android 1.2.0, code 22](https://github.com/erickolb/DangerRoom/releases/tag/v1.2.0) and [iOS 1.2.0, build 3](https://github.com/erickolb/DangerRoom/releases/tag/ios-v1.2.0-build3).

Both clients support native cover scanning, default hash distance 14 (range 10–20), local hashing, and a server-version check behind the loading screen. Minimum server: **1.1.0**; server **1.1.2** provides immediate results and background metadata enrichment. See the [cover image search walkthrough](https://erickolb.github.io/DangerRoom/hardlight/cover-image-search/). The website footer retains an Obtainium beta-channel setup link; stable downloads remain the default.

[View All Releases](https://github.com/erickolb/DangerRoom/releases)

## Licensing & Copyright
Copyright © 2026 Eric Kolb. Original DangerRoom and Hardlight code is licensed under [GNU AGPLv3 only](LICENSE), without warranty. [Licensing and third-party notices](THIRD_PARTY_NOTICES.md) explain source availability and separate asset terms.

Comic metadata from [Metron](https://metron.cloud), licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). DangerRoom selects and reformats metadata; adaptations remain under CC BY-SA 4.0. Cover artwork is excluded and belongs to its publishers or creators.

## AI Assistance Disclosure
This project was created with AI-assisted programming.
