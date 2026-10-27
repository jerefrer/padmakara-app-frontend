# Native UI flows (Maestro)

End-to-end checks of the iOS app, run on a simulator with no window: nothing takes
the focus on the Mac. They drive the development build (`expo-dev-client`), not Expo Go.

## Before every TestFlight build: `npm run e2e`

Do not ship unless it is green. One command runs every flow, signed out and signed in,
against the **local** API and exits non-zero on any failure, with a per-flow summary:

```bash
npm run e2e            # iOS simulator (the default)
npm run e2e:android    # Android emulator
npm run e2e:all        # both, one after the other
```

Run `npm run e2e:all` when a build for both stores is going out. `run-all.sh --platform
ios|android|all` is the same thing.

It checks JAVA_HOME and the tools the media flows need, boots the simulator (default
`iPhone 17 Pro`, `IOS_SIMULATOR` for another), checks the dev client is installed, starts the
local servers (see "Media fixtures"), checks the local database has the public event 920 the
flows search for, starts Metro if needed (dev-client mode, not `CI=1`), then runs
`.maestro/*.yaml` and `run-signed-in.sh`. It stops only what it started (simulator, Metro, the
servers) and always removes `.env.development.local`. Maestro's iOS driver is given 4 minutes
to start (`MAESTRO_DRIVER_STARTUP_TIMEOUT`), and a flow that failed only because the driver
was not ready is run once more; any other failure is final. A full run takes about
20 minutes on iOS (the media flows are the long ones), 9 on Android.

Everything runs against the local API, never production: the script writes the local URL
to `.env.development.local` before Metro starts and refuses to run if Metro does not serve
it. It also refuses to run unless `DATABASE_URL` in `padmakara-api/.env` is a local database,
since the media flows write rows. The API is always started by the script (rate limiting off,
wired to the local media): ports 3000, 3999, 9000 and 9443 must be free, so stop a `bun run
dev` you have running first.

What the flows cover:

| Flow | Checks |
| --- | --- |
| `settings-signed-out`, `sign-in-sheet`, `sign-in-invalid-email` | signed-out settings, sign-in sheet, malformed address |
| `event-original-language` | event 920 (Tibetan) lists TIB and EN tracks and the control reads "Tibetan + English" |
| `settings-language` | Language holds the Portuguese-tracks switch and the subtitle row; the choice shows as its value; Video playback exists |
| `publications-signed-out` | only the public editions are listed; the members-only ones are not |
| `signed-in/*` (sign-in, sign-out, settings-signed-in) | sign in, sign out, signed-in settings |
| `signed-in/play-audio` | a track of the fixture event plays: the inline clock runs, pausing stops it, and the mini-player follows to other tabs and reopens the event |
| `signed-in/bookmarks` | event, track and video bookmarks (the video one with a note) are listed in their three sections on the Bookmarks tab, and the video bookmark reopens the video at its position, not at the saved resume point |
| `signed-in/video-bookmark-upload` | a video bookmark made signed out stays on the device (no database row), is uploaded when the video opens after signing in (a database row), and then shows on the Bookmarks tab |
| `signed-in/offline-playback` | pre-download the fixture event, stop the API, object storage and CDN, and a track nobody played yet still plays |
| `signed-in/app-lock` | with the app lock on, a cold start shows the lock cover (burgundy, Face ID prompt) and not the home screen, until Face ID matches |

The five media flows are iOS only (`# e2e: ios-only` in the file): the Android run skips
them and says so in the summary.

## iPad layouts

`.maestro/ipad/tour.yaml` signs in on an iPad simulator and takes a screenshot of home, events,
search, an event with audio, publications, bookmarks and settings, in portrait and then
landscape (`setOrientation`). The pictures are the check: read them for overlaps, clipped
content, a second player or an unreachable sidebar. The layout follows the window width
(<744 phone, 744-1024 compact rail, 1025+ desktop), so also try a 13-inch iPad and Split View.

```bash
IOS_SIMULATOR="iPad Air 11-inch (M3)" SHOTS_DIR=/some/dir npm run e2e -- --suite ipad
# or: .maestro/run-all.sh --suite ipad
```

It uses the same local servers, Metro and magic-link helper as the full run, then writes
`<portrait|landscape>-<n>-<screen>.png` into `SHOTS_DIR` (default `$TMPDIR/ipad-shots`). It is not
part of the default run. The dev client must be installed on the iPad simulator (the runner
installs it from `ios/build` when missing).

## Media fixtures

Local storage credentials for the real bucket are denied and local and prod use different
buckets, so the media flows run on a fixture the script builds itself (`fixtures/`):

- `seed.sql` (idempotent, local database only): event `E2E-FIXTURE` (id 990001, published,
  free) with two 90 s audio tracks (`track-row-990001`, `-990002`) and one video (id 990001).
- `media.sh`: generates the audio (mp3) and the video (HLS) with ffmpeg into
  `fixtures/.cache/` (git-ignored) and uploads the audio to a throwaway MinIO. The video's
  picture is eight black/white columns that spell the playback second in binary: the player
  shows no clock, so the flows read the position from a screenshot.
- `services.sh`: MinIO on :9000, a stand-in for the Bunny CDN on :9443 (`cdn-server.ts`;
  the API only knows Bunny, over https, so it signs with a throwaway CA that the script
  trusts in the simulator keychain and gives to the API), and the API on :3000 pointed at
  both. The API stays on the real code paths: presigned audio URLs, the HLS proxy.
- `control-server.ts` (127.0.0.1:3999): what a flow cannot do itself and asks the runner for
  through `scripts/control.js`: stop/start the three servers (offline flow), match Face ID,
  clear the fixture's bookmarks, read `video_bookmarks`, read the video position or the
  lock cover from a screenshot.

Needs `minio`, `ffmpeg`, `openssl`, `psql` and `bun` on the PATH (`brew install minio/stable/minio
ffmpeg openssl libpq oven-sh/bun/bun`). The fixture rows stay in the local database after a run
(harmless: the event is dated 2024 and only the local API serves it).

Things the flows learned about the app, so they are not rediscovered:

- Tapping a track while nothing plays loads it paused, by design: the flows tap play too.
- The native video player exposes no clock or controls to Maestro.
- The Face ID system prompt hides the app's own elements from the accessibility tree: the
  lock flow waits for the prompt ("Face ID") and judges the cover by colour.
- `ConfirmationModal` is built from `accessible={false}` containers so its buttons have their
  own accessibility elements (`confirm-default`, `confirm-cancel`, `confirm-destructive`);
  before, VoiceOver and Maestro saw the whole card as one element.

Not covered locally: **Read Along** (Aa size picker). The alignment JSON is served from
object storage, local credentials are denied and local and prod use different buckets, so
the API answers 500 and the viewer shows "not available". The size picker has a component
test in `components/ReadAlongViewer.test.tsx`.

## One-time setup

```bash
brew install openjdk@17 mobile-dev-inc/tap/maestro
APP_VARIANT=pt npx expo prebuild -p ios        # ios/ is generated and git-ignored
cd ios && xcodebuild -workspace Padmakara.xcworkspace -scheme Padmakara \
  -configuration Debug -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" -derivedDataPath build/DerivedData build
```

Rebuild only when a native dependency, the Expo SDK or `app.config.ts` changes.
JavaScript changes are picked up by Metro.

## Android (one-time setup)

The flows are the same files on both platforms; only `subflows/launch.yaml` branches
(`platform: iOS` / `Android`) for the dev launcher and the dev menu.

```bash
brew install openjdk@17                        # JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=~/Library/Android/sdk      # SDK with platform-tools, emulator, an arm64 AVD
APP_VARIANT=pt npx expo prebuild -p android    # android/ is generated and git-ignored
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
(cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a)   # ~13 min the first time
```

`npm run e2e:android` then boots the AVD headless (`Medium_Phone_API_35`, or `ANDROID_AVD`),
runs `adb reverse tcp:8081` and `tcp:3000` so the emulator reaches Metro and the local API
as `localhost` (the same `.env.development.local` serves both platforms), installs
`android/app/build/outputs/apk/debug/app-debug.apk` if the dev client is missing, and shuts
the emulator down afterwards if it started it. The dev launcher lists Metro as
`http://10.0.2.2:8081` there. The first bundle after a Metro start takes a few minutes.

Rebuild the Android dev client only when a native dependency or `app.config.ts` changes.
Keep native modules aligned with the Expo SDK: a stray `expo-asset` of another SDK made the
Android app render a blank screen (fonts never loaded), which is why `expo-asset` is a
direct dependency pinned to the SDK's version.

## Run one flow by hand

```bash
xcrun simctl boot "iPhone 16"                  # headless: do not open Simulator.app
xcrun simctl install "iPhone 16" ios/build/DerivedData/Build/Products/Debug-iphonesimulator/Padmakara.app
npx expo start --dev-client                    # keep running; not CI=1, which stops file watching
JAVA_HOME=/opt/homebrew/opt/openjdk@17 maestro test .maestro
```

`subflows/launch.yaml` starts from a fresh install, opens the local Metro server from
the dev launcher and closes the dev menu that introduces itself on first launch.

## Signed-in flows

`signed-in/` signs in for real, against the **local** API and its database, with
`payment-test@padmakara.pt` (set `EMAIL` with `-e EMAIL=…` for another local user).
Nobody receives an email: the dev API prints the magic link to its log, and
`run-signed-in.sh` opens each new one while the app waits on the sign-in sheet.

```bash
(cd ../padmakara-api && RATE_LIMIT_ENABLED=false bun run dev > /path/to/api.log 2>&1) &
npx expo start --dev-client                    # as above
API_LOG=/path/to/api.log JAVA_HOME=/opt/homebrew/opt/openjdk@17 .maestro/run-signed-in.sh
```

- Rate limiting is off because every flow asks for a link for the same address (the
  API allows 3 per 15 minutes).
- The dev bundle reads `EXPO_PUBLIC_API_URL` from the `.env` files themselves, so a
  shell variable cannot point it elsewhere. The script writes the local URL to
  `.env.development.local` for the run and deletes it after; it refuses to start if
  Metro does not pick it up, so the flows never request a link from production.

If a run is interrupted on an iOS "Open in Padmakara?" dialog, restart the simulator
(`xcrun simctl shutdown` then `boot`): the system dialog outlives the app.
