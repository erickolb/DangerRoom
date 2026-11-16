# Contributing

Read the [project overview and setup](README.md) and [project instructions](AGENTS.md) before making changes. The [API and data model](docs/api.md) describes persistence and request behavior; [Advanced usage notes](docs/advanced-usage-notes.md) explains user-visible interactions that changes should preserve.

## Development and verification

Use Node.js 24 or later and install dependencies with `pnpm install --frozen-lockfile`. No frontend build is required. Start locally with `pnpm start`, or use `pnpm run dev` to restart automatically after server code changes. Keep `.env`, credentials, collection data, and signing keys out of Git.

Run these checks before submitting application changes:

```sh
pnpm run check
pnpm test
```

Tests use isolated temporary databases and simulated Metron responses, not your collection or API credentials. They do not establish that a live Metron account works; live provider verification needs a private local token. Choose additional platform or manual checks appropriate to the change. Native build and signing instructions live in the [Hardlight for Mobile guide](docs/hardlight-for-mobile.md#build-and-publish).

## Where changes belong

| Location | Purpose |
| --- | --- |
| `src/` | Server, provider integration, and persistence |
| `public/` | Self-hosted collection application, including shared Hardlight screens |
| `android/` and `ios/` | Native Hardlight clients |
| `website/` | Public feature, download, installation, and privacy website |
| `docs/` | User, operator, API, and platform documentation |

The public website is separate from the collection application. `.github/workflows/pages.yml` deploys GitHub Pages; the workflow deploys only from `main`. A published release starts a separate `workflow_dispatch` run on `main`; the release-tag run does not enter the protected `github-pages` environment. Keep that environment restricted to `main`. Successful iOS release builds also trigger deployment so the SideStore source includes the latest published IPA. This workflow maintenance alone requires no server container update or Hardlight version change. Verify the deployed page when publishing website or download changes.

Format badge PNGs are prebuilt assets. On Windows, `scripts/generate-format-badges.ps1` regenerates them from code. Preserve accessible format names when changing their presentation.

## Component versions and releases

Before implementing a requested change, agree with the maintainer on whether it affects the DangerRoom server, Hardlight, or both, and on each affected component's version. Follow [AGENTS.md](AGENTS.md): major changes increment the first number, features the second, and incremental changes the third, resetting lower numbers. Server and client versions are independent. Do not bump an unaffected component. Research and documentation alone do not require an application release.

`public/releases.js` drives the server footer build label and in-app Changelog. Keep the package version, release data, [Changelog](CHANGELOG.md), and README release information consistent. Keep alpha and beta histories separately collapsed. Related implementation and verification fixes belong to the agreed build.

Mirror Hardlight features on Android and iOS unless explicitly scoped to one platform. Publish signed artifacts, checksums, and release notes in `erickolb/DangerRoom`, using separate platform tags and titles. Follow each platform guide for signing, build numbers, and release procedures. Keep `website/`, installation guides, the SideStore feed where applicable, and README downloads aligned with published releases. Do not publish DangerRoom artifacts or download pages in QuartermasterIntake.

For server changes requiring a container update, maintain [updates, backups, and rollback](docs/updating.md) and link it when reporting the completed commit. Use `sudo docker` and `sudo docker compose` on your server. Keep migrations and operator procedures documented there rather than requiring operators to infer commands from source.

Preserve licensing, source availability, attribution, and asset modification notices described in [third-party notices](THIRD_PARTY_NOTICES.md). Commits pushed to the owner's repository use author and committer Eric Kolb, `eric@erickolb.me`.
