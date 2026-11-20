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

---

## 2026-10-27 — Native iPad uses the web tablet/desktop layouts, driven by width
**Chosen:** `utils/layout.ts` (`computeLayout`) is the single source for the layout. iPhones are always mobile. An iPad follows its window WIDTH, never its orientation: below 744 mobile (Split View, Slide Over), 744-1024 tablet (a 72pt icon rail, no right rail, no related-events column, the shell's player bar is the only player), 1025+ the web desktop layout. Web output is unchanged (768/1025 thresholds, full sidebar and right rail on 768-1024); the only web change is that Bookmarks and Account are now in the sidebar. On native, the (tabs) and (groups) layouts keep one tree at every width: hidden slots stay mounted-but-empty so the navigator never remounts when the width crosses a breakpoint.
**Alternatives:** an orientation-based switch (wrong in Split View and on 13-inch iPads); making web 768-1024 use the new compact tablet too (would change shipped web behaviour); a separate iPad route tree (duplicates every screen).
**Why:** an iPad has a desktop-class screen, the layouts already existed for web, and width is the only signal that stays right through multitasking and rotation. 744 (not 768) so an iPad mini in portrait gets the tablet layout.
**Trade-offs:** the web 768-1024 range keeps its odd desktop chrome with mobile content for now; native content on the iPad tablet is still the phone content (full-bleed lists) next to a rail.
**Revisit if:** web tablet gets the compact rail too, or a tablet-specific event page (two columns) is wanted.

---

## 2026-10-28 — The passkey invitation also reaches members who are already signed in
**Chosen:** User decision: the invitation to save a passkey is shown once per user per device, by two triggers sharing one flag (`passkeyInvite:<userId>` in AsyncStorage, set when the invitation is shown, whatever the answer). Trigger 1: right after an email sign-in (link or code) in the sign-in form and on the full-page check-email screen, then the person continues where they were going. Trigger 2: on the home screen for a member who was already signed in, after a short pause, only while the screen is in front and no audio or video is playing (so never over the player, a reading screen or a modal), only when passkeys are supported, the member has no passkey yet and the list request succeeded. A passkey sign-in never triggers it.
**Alternatives:** after-sign-in trigger only (members signed in before this release would never see it); a banner on home (easy to ignore, not the designed moment); showing it at app start (can cover the player or a reading screen).
**Why:** most members stay signed in for months, so an invitation tied only to a fresh email sign-in would reach almost nobody; a lookup of the member's passkeys (not a guess) keeps those who already have one from being asked.
**Trade-offs:** one extra request to the passkey list on a member's first home visit per device; `magic-link.tsx` (full-page link verification) does not trigger trigger 1, the home trigger covers it; a member who signs in on the same device shortly after the flag is set is never asked again there.
**Revisit if:** members report being interrupted, or passkey adoption stays low.

---

## 2026-10-28 — Passkey invitation cadence, wording and Android status
**Chosen:** The invitation is shown once per user per device (flag `passkeyInvite:<userId>`, set when it is shown, whatever the answer). Platform wording depends on `Platform.OS` and the user agent only, never on probing biometric hardware: "Face ID or Touch ID" on iOS (and iOS/macOS browsers), a generic "fingerprint or face" elsewhere; the Settings block is titled "Face ID & passkeys" on Apple platforms and "Passkeys" otherwise. The relying party ID is `app.padmakara.pt` (the apex is a Wix site that cannot serve `.well-known`). Android native passkeys are pending the signing certificate fingerprints: they must be filled in `public/.well-known/assetlinks.json` and as `android:apk-key-hash:...` origins in the API's `WEBAUTHN_ANDROID_ORIGINS`; until then Android native fails gracefully and web passkeys on Android Chrome work regardless.
**Alternatives:** asking at every sign-in (nagging); detecting biometrics before choosing the wording (the platform APIs do not say which biometric will be used, and a wrong "Face ID" promise is worse than a generic one); RP ID `padmakara.pt` (cannot host the association files); hiding Android passkeys entirely (web passkeys on Android work today).
**Why:** one invitation respects the member; platform-only wording is predictable and testable; the RP ID is the only domain where we control `.well-known`.
**Trade-offs:** a member who dismisses the invitation must find Settings; the wording can be wrong on a Mac without Touch ID; Android native cannot be used until the Play and EAS fingerprints are known; changing the RP ID later invalidates every saved passkey.
**Revisit if:** the Play Console signing key is available (fill the fingerprints), the apex domain can serve `.well-known`, or adoption suggests asking again after a time.

---

## 2026-10-28 — Passkey invitation trigger 1 runs from a persistent gate
**Chosen:** The invitation right after an email sign-in no longer starts from the sign-in form or the check-email screen. The sign-in code (sheet/card form, 6-digit code, review code, check-email polling, magic-link screen, link auto-activation) sets a module-level "email sign-in just completed" marker (`hooks/passkeyInviteState.ts`) BEFORE awaiting `refreshAuth()`. `PasskeyInviteGate`, mounted inside `SignInProvider` for the whole app lifetime, consumes the marker once `isAuthenticated && user`, waits 1.5 s (sheet dismissal, check-email's own redirect) and then calls `inviteAfterEmailSignIn`. A passkey sign-in never sets the marker and clears a stale one. The invitation route opens only when a trigger armed it just before navigating; a reload or browser Back goes home.
**Alternatives:** keeping the in-form hook (it almost never ran: `refreshAuth()` flips `isAuthenticated` first, which closes the sheet and unmounts the form before `phase === 'done'` is seen); using the persisted flag to guard the route (the triggers set it before navigating, so it cannot tell the first display from a repeat).
**Why:** the screens that complete a sign-in unmount as soon as the session is known, so only a component that outlives them can reliably react. One code path, with the shared per-device flag still preventing a second display.
**Trade-offs:** a fixed settle delay instead of a navigation event; the marker is in-memory, so an app kill between sign-in and the gate drops the invitation (home trigger 2 covers it later).
**Revisit if:** the delay proves too short on slow devices, or Expo Router exposes a reliable "modal dismissed" signal.

---
## 2026-11-16 — Patch expo-video so leaving Picture in Picture keeps the video playing
**Chosen:** a `patch-package` patch on `expo-video` (`patches/expo-video+58.0.13.patch`). In
`OrientationAVPlayerViewController.restoreUserInterfaceForPictureInPictureStop…`, the branch that
does not re-enter fullscreen now answers `true` when the player's view is still in a window, instead
of always `false`.
**Alternatives:** `fullscreenOptions.keepFullscreenOnPiPStop: 'always'` (JS only, but it covers only
PiP started from fullscreen, not from the inline player on the video page); resuming playback from
JS on `onPictureInPictureStop` (treats the symptom, and the view is still not restored).
**Why:** expo-video added this delegate method in April 2026 (expo/expo#44811, for
`keepFullscreenOnPiPStop`). Before that, AVKit returned the video to the inline player by itself.
Now every PiP that is not restored to fullscreen tells AVKit the app has no UI to return to, and
André saw the video stop when he tapped to leave PiP. Upstream main still has the same code.
**Trade-offs:** a native patch to carry, and it only takes effect while iOS builds compile Expo
modules from source (`EXPO_USE_PRECOMPILED_MODULES` unset, as now). Checked only by typechecking the
expression against the iOS SDK; the behaviour needs a device.
**Revisit if:** expo-video changes this method (the patch then fails loudly on install), or the
project turns on precompiled Expo modules.

---
## 2026-11-17 — Stop the native PDF reader from going back to page 1 on iPad taps
**Chosen:** two changes. (1) `ReaderTopBar` reports its height only while it is shown, so a tap no
longer changes the document's `contentInsetTop`. (2) In the `react-native-pdf` patch
(`RNPDFPdfView.mm`), `updateProps` compares the path by value (it compared `NSString` pointers, so
every prop update reloaded the document at page 1), and a layout change after the first one no
longer replays the initial `page` prop.
**Alternatives:** passing the current page back as the `page` prop (each update would then snap to
the top of that page while the reader scrolls); not hiding the status bar on tap (hides the
symptom on iPad only, and any other prop change would still reload the document).
**Why:** a tap hides the status bar; on an iPad (and a phone without a notch) that shrinks the
safe area, the reader bar loses that height, and the new inset reached the native view. Any prop
update counted as a new path there, so the document was reloaded and opened on page 1. The tap's
"internal link" heuristic in `PDFViewer` then saw a jump of many pages and showed the bars again,
which is why André saw only the jump. Rotation and Split View resizes went back to page 1 too,
through the replayed `page` prop.
**Trade-offs:** more native patch to carry, checked by reading and by tests with the native view
mocked, not on a device. The iPad's side rail and player bar stay on screen when the bars hide:
removing them resizes the PDF view, which is what crashed PDFKit before (see a6e8dc15).
**Revisit if:** react-native-pdf fixes the path comparison upstream (the patch then fails on
install), or hiding the iPad rail and player bar is wanted (needs a device test for PDFKit).

---
## 2026-11-18 — The open video lives above the navigator and floats when its page is left
**Chosen:** the event screen no longer renders `VideoPlayer`. It calls `openVideo` on
`VideoSessionProvider` (root layout), and `VideoHost`, mounted once after the root `<Stack>`,
renders the player. The page is no longer a React Native `Modal` but an absolutely filled view in
that host; leaving it while the video plays (close chevron, Android back, Escape on the web)
switches to `minimized`, which only restyles the same containers into a floating 16:9 window
(above the tab bar and the audio bar on phones, bottom right above the player bar on iPad and
desktop) with close, expand and play/pause. The `VideoView` (native) or `<video>` (web) keeps its
place in the tree, so it is never remounted. Leaving a paused, loading or failed video closes it,
as before. The window's close button saves the position, pauses and releases the player.
**Alternatives:** keeping the player in the event screen and portalling only the view (the
`VideoPlayer` instance would still be released when the screen unmounts); a second `VideoView` on
the same player in a separate floating component (two native views on one player is unreliable on
Android, and on the web it is a second `<video>` that reloads the stream); a `Modal` page plus a
floating window (moving a view between a `Modal` and the app root remounts it: restart and rebuffer).
**Why:** André and Ana Paula saw the video stop and vanish when they navigated after closing the
page. `useVideoPlayer` belonged to the event screen, so leaving the screen released the player
(and the page's close button paused it first). The audio mini player survives navigation because
its player lives in a root provider; the video now does the same.
**Trade-offs:** no slide-in animation for the page (it was the `Modal`'s); Android back and web
Escape are handled by hand; the window is docked, not draggable; the system PiP is still started
only from the native controls (`startsPictureInPictureAutomatically` stays off, and Android has no
`supportsPictureInPicture` in the expo-video plugin). Verified in jest and on the web export; the
native floating window (iOS layout, Android SurfaceView inside a small overlay) still needs a device.
**Revisit if:** testers want to drag the window, or want the floating window to enter the system PiP
when the app goes to the background.

---
## 2026-11-19 — PDF reader: resume on the last page, page bookmarks

**Chosen:** User decision (Jérémy, from André and Ana Paula) for the features. The reader
(publications and transcripts, web and native) reopens on the page last read and lets the reader
bookmark pages from a header icon next to the table of contents; the bookmarks are listed at the
top of the contents sheet (with the chapter each falls in) and in the Bookmarks tab ("Pages").
Stored on the server per account (`/api/reader/:type/:id`) and on the device. The last page is
kept per device, not per account (like the "Last opened" times), and the more recent of device and
server wins. Bookmarks are kept per account ('anon' signed out); signed in, the device copy mirrors
the server and queues changes made offline until the next sync. The viewer waits up to 1.5 s for
the server before opening on the device's page; the page is saved 2 s after the last turn and at
once on close or when the app goes to the background. Native: the page is passed once as
react-native-pdf's `page` prop and never changes (the package already sends a constant `page: 1`
on every update, and the iOS patch stops replaying it on layout changes), so taps and rotation do
not jump. Web: the viewer now reports pdf.js's outline and exposes goToPage, so the web reader gets
the same contents sheet.
**Alternatives:** passing the current page back as the `page` prop (rejected on 2026-11-17: each
update would snap to it); calling `setPage` after load (a visible jump from page 1); bookmarks per
device only (they would not follow the person); merging signed-out bookmarks into the account at
sign-in (on a shared device they would land in someone else's account).
**Why:** "It is the usual behaviour in PDF readers" (André); Ana Paula wants quick access to the
pages she uses most, on her phone and computer alike.
**Trade-offs:** bookmarks made signed out stay on the device and are not moved into the account.
In two-page mode the header bookmark applies to the page the viewer counts as current (the
left one, or the page a link went to). The native resume is covered by tests with the native view
mocked, not by a device run.
**Revisit if:** testers want signed-out bookmarks carried into their account, or a bookmark per
spread in two-page mode.

---

## 2026-11-20 — Document readers take the whole window on the web and the iPad
**Chosen:** A reader (publication, transcript) tells the desktop shell it is open (`setReaderFullWindow`, from `useReaderBars(active, { fullWindow: true })`); the shell hides, without unmounting, the sidebar, right panel, edge shadows and player bar. On the web the reader's top bar is laid over the page like on the phone, the viewer's toolbar sits right under it (both fade together), and a click on the page that is not a link, a selection or a drag toggles them. Fullscreen takes the whole page (`documentElement`) and its button is hidden where the Fullscreen API is missing.
**Alternatives:** A `position: fixed` overlay above the shell (rejected: the sidebar and its tab stops stay in the page, and iPad needs a different fix); reflowing the page when the bars hide (rejected: the text jumps, fit-page rescales).
**Why:** André asked for the phone's reader on desktop and iPad (2026-11-20). The viewer keeps a fixed room for the bars when they are hidden, as the phone does, so the page never moves on a tap.
**Trade-offs:** The player bar is not reachable while a document is open. When the bars are hidden the room above the first page stays blank until scrolled away. The web has no page-number badge while the bars are hidden.
**Revisit if:** André wants the audio controls kept in view while reading, or the two top rows merged into one banner.

---
