# Licensing and third-party notices

Copyright © 2026 Eric Kolb. DangerRoom and Hardlight's original source code is
licensed under the GNU Affero General Public License, version 3 only
(`AGPL-3.0-only`). See [LICENSE](LICENSE). This software is provided without
warranty. You may modify and redistribute it under that license.

## Android cover capture and hashing

The Android beta uses Google ML Kit document scanner (`play-services-mlkit-document-scanner`) through Google Play services. See [Google ML Kit document scanner](https://developers.google.com/ml-kit/vision/doc-scanner) and its applicable terms.

`PerceptualHash.kt` and Python ImageHash golden test vectors are adapted from Eric Kolb’s [CPHTest experiment](https://github.com/erickolb/metron/tree/experiment/perceptual-hash-matching/android). The package name is changed; DangerRoom uses the hash with Metron’s production issue-list filters rather than the experiment endpoint.

## Metron metadata

Comic data from [Metron](https://metron.cloud), licensed under
[Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
See [Metron's API-use and licensing guidance](https://metron-project.github.io/blog/commercial-api-use).

DangerRoom selects metadata fields, normalizes their structure, formats titles
and dates, and combines them with user-supplied ownership, ratings, and reading
dates. Adaptations of Metron metadata remain under CC BY-SA 4.0. The software
license does not replace the metadata license or license users' private records.
Metron does not endorse DangerRoom or Hardlight.

The shared web footer supplies attribution and a license link in the browser and
both Hardlight clients. Record source URLs and upstream attribution are retained
when supplied by the API. Descriptions are not currently imported or displayed.

When sharing adapted metadata, including public catalogues, datasets, or database
copies, retain Metron attribution, source and license links, supplied notices,
and indications of changes; license the adapted metadata under CC BY-SA 4.0.
Do not add restrictions that remove recipients' rights under that license.
DangerRoom currently has no user-facing metadata export feature. Any future
export must carry these notices alongside the metadata. Private backups do not
require publication; check for personal records and credentials before sharing.

## Cover artwork and branding

Cover images supplied through Metron are **not** covered by Metron's CC BY-SA
license or DangerRoom's AGPL license. Copyright belongs to their publishers or
creators. Metron's own fair-use rationale does not automatically establish
permission for downstream uses. Operators must assess their use or obtain
permission. These licenses do not grant third-party trademark rights.

The Metron logo is sourced from
[The Metron Project](https://github.com/Metron-Project/metron/blob/master/static/site/img/metron.svg).
Its use here is not a claim of endorsement or ownership.

## Icons and dependencies

Image Search by Muhammad Adam from [Noun Project](https://thenounproject.com/browse/icons/term/image-search/), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). `public/image-search.png` is the supplied black icon with only its embedded bottom-left credit text cleared; artwork, canvas size, and transparency are retained. CSS inverts it for display on the dark menu. Attribution remains in the app’s Credits and README.

The application Credits section preserves the individual Flaticon and Noun
Project icon credits and modification notices. These assets retain their own
terms and are excluded from the original-code AGPL grant. Dependencies retain
their own licenses and notices, which must be preserved when distributing them.

## Source availability

Source for DangerRoom and both Hardlight clients is available at
[erickolb/DangerRoom](https://github.com/erickolb/DangerRoom). Distributed binaries
must be accompanied by access to their corresponding source, including build
scripts, under the AGPL terms. Preserve source tags for published versions.

Operators of modified network-accessible versions must prominently offer users
the corresponding source for the version actually running, at no charge, as
required by AGPL section 13. Update the shared footer's source link to your fork
and matching revision; a link to the original upstream repository alone is
insufficient for unpublished modifications. Keep secrets and personal data out
of source distributions.
