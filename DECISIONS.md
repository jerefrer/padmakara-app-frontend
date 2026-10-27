# Decisions

## 2026-10-22 — Patch the slider for a thumbless seek bar on iOS 26
**Chosen:** a `patch-package` patch on `@react-native-community/slider`
(`patches/@react-native-community+slider+5.0.1.patch`, applied by `postinstall`). On iOS 26+,
a fully transparent `thumbTintColor` switches the native slider to `UISliderStyleThumbless`;
any other tint, or none, restores the normal thumb. The audio player passes a transparent
tint at rest and no tint while scrubbing.
**Alternatives:** a transparent `thumbImage` (tried: iOS 26 still draws its glass dot);
drawing our own progress line under an invisible slider (works everywhere, but the native
track may visibly change on touch).
**Why:** the designer wants only the red progress line at rest and the see-through glass dot
while pressing. iOS 26 has a style for exactly this, but slider 5.2.1 (latest, Aug 2026)
does not expose it.
**Trade-offs:** a native patch to carry. `patch-package` fails loudly when the library
version changes, which is the moment to check whether upstream now supports `sliderStyle`.
**Revisit if:** the slider library exposes the thumbless style, or a version bump breaks
the patch. Also check on a device that scrubbing still works when the style switches
mid-gesture (not verifiable on the simulator).

---

## 2026-10-24 — Run the media e2e flows on a local fixture, not on prod media
**Chosen:** `npm run e2e` seeds a fixture event (`E2E-FIXTURE`, id 990001) into the LOCAL
database and serves its media from a throwaway MinIO (audio) and an https stand-in for the
Bunny CDN (video HLS, signed by a throwaway CA that the simulator trusts). The API is started
by the runner, wired to both, and a small control server lets flows cut the network, match
Face ID, clear the fixture's bookmarks and read the local database. The fixture video's
picture spells the playback second in binary, because the player exposes no clock.
**Alternatives:** pointing the app at prod media (credentials denied locally, and the flows
write bookmarks); mocking the API in the app (would not test the presigned/HLS-proxy paths);
asserting video position through the native controls (not exposed to Maestro).
**Why:** audio, video, offline and bookmark journeys are what a TestFlight build most needs
checked, and they cannot run without playable media on the real code paths.
**Trade-offs:** a longer run (about 16 minutes), five local tools to install (minio, ffmpeg,
openssl, psql, bun), and the flows are iOS only. `ConfirmationModal` containers became
`accessible={false}` so its buttons are separate accessibility elements.
**Revisit if:** the API gains a local media mode, or the run time becomes a reason to skip it.

---

---

## 2026-10-27 — Sign-out is best effort, then honest
**Chosen:** "Sign out of this device" always ends in the signed-out UI. Each local removal (tokens, cached user, activation record) runs independently; if one fails, the user is told ("signed out, but some data could not be removed — restart the app") and a `pending_local_cleanup` flag (a timestamp only) makes the next app start retry the removal. The retry is skipped, and the flag dropped, when `activation_date` is newer than the flag, so a sign-in made in between is never undone.
**Alternatives:** rethrow and show "sign-out failed" (misleading when the user is half signed out); keep swallowing errors (could leave a token on a shared device without anyone knowing); guard on `isDeviceActivated` (a failed removal leaves it true, so the cleanup would never run).
**Why:** the user asked to be signed out; the UI must say so, and any leftover credential must not stay silent.
**Trade-offs:** the freshness check compares `activation_date` with the device clock; `activation_date` can come from the server's `activated_at`, so heavy clock skew could misjudge it (worst case: a leftover is cleared one start later, or a cleanup is skipped).
**Revisit if:** sign-out failures show up in Sentry, or activation dates move fully server-side.
