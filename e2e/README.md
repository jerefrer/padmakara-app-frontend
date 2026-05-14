# End-to-End Tests

Real-browser Playwright tests against the running Expo web dev server.
Catches bugs that unit tests with mocked `expo-audio` cannot — specifically
anything dependent on the actual `HTMLAudioElement` lifecycle, presigned
URL refresh, or multi-render race conditions that the mock doesn't model.

These tests are **local-only**, **manual on demand**. No CI integration.

## Pre-requisites

1. **Dev server running** at `http://localhost:8081`:
   ```
   npm start
   ```
2. **Backend reachable** (presigned S3 URLs must resolve).
3. **Auth state** (only needed for tests that hit authenticated content —
   `audio-resume.spec.ts` does not, but future tests will):
   ```
   npm run test:e2e:setup
   ```
   Opens a headed browser. Complete the magic-link login interactively
   (real email, real link click). Once the home tab loads, the storage
   state is saved to `e2e/.auth/storage-state.json`. Re-run when the
   auth state expires.

## Run

```
npm run test:e2e
```

## Adding a test

- New `*.spec.ts` files in this directory are picked up automatically.
- For UI interactions, prefer querying by visible text (`div[tabindex="0"]`
  + `textContent.startsWith(...)`) over CSS selectors — RN-Web doesn't
  give us stable classnames.
- For low-level audio state, use `page.addInitScript` to instrument
  `HTMLMediaElement.prototype.currentTime` and `window.Audio` before any
  page script runs. See `audio-resume.spec.ts` for the pattern.

## When to add an e2e test vs a jest test

Use **jest** (in `contexts/`, `services/`, etc.):
- Pure logic, isolated units, hook integration.
- Anything the mock can model honestly. Fast feedback.

Use **e2e** (here):
- Anything that depends on real browser audio event timing (e.g. `onseeked`
  is async — the mock can't reproduce that).
- Cross-component flows that span real DOM + real network.
- Bugs reported as "this works in my unit test but breaks in the app" —
  add an e2e for the failing scenario first.

The audio resume A→B→A bug is the example of why this exists:
the jest mock made `seekTo` update `status.currentTime` synchronously
(matching its singleton store), but the real browser only updates
`status.currentTime` when `onseeked` fires asynchronously — a 50–300 ms
gap that lets `playTrack` save the outgoing track at position 0.
The jest tests cannot catch that race; this e2e does.
