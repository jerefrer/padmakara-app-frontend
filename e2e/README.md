# End-to-End Tests

Automated Playwright tests of the classic Padmakara user journeys, run in a
real browser against the full stack — Expo web app, Hono backend, seeded
Postgres database, and local MinIO object store.

`npx playwright test` (or `npm run test:e2e`) does **everything** itself: no
servers to start by hand, no manual login.

## What runs

```
globalSetup    → spawns the e2e infra runner (padmakara-api worktree):
                 resets + migrates + seeds the padmakara_test database,
                 starts local MinIO, uploads fixture media. MinIO stays up
                 for the whole run.
webServer[0]   → Hono backend on :3100, started with explicit test-env
                 overrides so it connects ONLY to padmakara_test + local
                 MinIO — never the real database or AWS S3. NODE_ENV=test.
webServer[1]   → Expo web dev server on :8181, EXPO_PUBLIC_API_URL → :3100.
globalTeardown → stops the infra runner (clean MinIO shutdown).
```

Dedicated ports 3100 / 8181 are used (not the dev defaults 3000 / 8081) so
the test stack never collides with — or reuses — a developer's running dev
servers, which are connected to the real database.

## Prerequisites

- PostgreSQL running locally with a `padmakara_test` database reachable at
  `postgresql://localhost:5432/padmakara_test` (the runner resets it each run).
- The `minio` binary on PATH.
- `bun` installed (the backend + infra runner are Bun scripts). Override the
  path with `BUN_BIN` if it is not at `~/.bun/bin/bun`.
- Chromium installed for Playwright: `npx playwright install chromium`.

## Run

```
npm run test:e2e
```

## Authentication

Auth is programmatic and per-test — no magic-link email round-trip. Each spec
mints a JWT for a seeded user via the backend's test-only endpoints
(`/api/test/user-by-email`, `/api/test/token`) and injects it into
`localStorage` (`auth_token`, `device_activated`, `user_data`) before the
first navigation. See `support/auth.ts`.

The six seeded users (`support/auth.ts` → `TEST_USER_EMAILS`) cover every
access level: no-subscription, subscriber, group member, event participant,
granted-by-attendance, and admin.

## Seeded dataset

The deterministic seed creates one event per access level (E2E-ANYONE,
E2E-SUBS, E2E-GROUP, E2E-PART, E2E-REQ, E2E-INIT), each with one session, two
tracks, and a transcript, plus one retreat group. Specs resolve the DB ids
via `support/dataset.ts` (backed by `GET /api/test/dataset`) instead of
hard-coding seed-order ids.

## Suites

| File | Journey |
|------|---------|
| `navigation.spec.ts`     | login → home → groups → group → event → transcript |
| `audio-player.spec.ts`   | open a track, player controls render and respond |
| `bookmarks.spec.ts`      | create a bookmark, see it on the Bookmarks screen |
| `downloads.spec.ts`      | request an event ZIP, see the request acknowledged |
| `search.spec.ts`         | search a seeded event, open a result |
| `access-control.spec.ts` | the right users see the right restricted content |

### Fixture media caveat

The fixture audio/PDF objects in MinIO are **placeholder bytes**, not real
media. The browser cannot decode them, so `audio-player.spec.ts` asserts
player **UI/state** behaviour (controls render, play/pause toggles, track
switching) — not actual sound output — and the transcript test asserts the
viewer chrome renders, not rendered PDF pages. Testing real decoded playback
would require committing a real audio fixture.

## `audio-resume.spec.ts`

Skipped in the automated suite (`test.describe.skip`). It predates the seeded
harness and hard-codes production event/track ids that do not exist in the
seed dataset. It is kept as a manual regression check — see the comment at
the top of that file.

## Adding a test

- New `*.spec.ts` files in this directory are picked up automatically.
- Prefer `page.getByTestId(...)` — most interactive elements carry a stable
  `testID`. Where one does not exist, use visible text or a direct deep link.
- Use `authenticateAs(page, '<userKey>')` before the first `page.goto`.
- Resolve DB ids through `support/dataset.ts`, never hard-code them.
