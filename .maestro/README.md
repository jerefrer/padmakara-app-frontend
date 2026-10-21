# Native UI flows (Maestro)

End-to-end checks of the iOS app, run on a simulator with no window: nothing takes
the focus on the Mac. They drive the development build (`expo-dev-client`), not Expo Go.

## Before every TestFlight build: `npm run e2e`

Do not ship unless it is green. One command runs every flow, signed out and signed in,
against the **local** API and exits non-zero on any failure, with a per-flow summary:

```bash
npm run e2e            # iOS simulator
```

It checks JAVA_HOME, boots the simulator, checks the dev client is installed, checks the
local API on :3000 (and that its database has the public event 920 the flows search for),
starts Metro if needed (dev-client mode, not `CI=1`), then runs `.maestro/*.yaml` and
`run-signed-in.sh`. It stops only what it started (simulator, Metro, API) and always
removes `.env.development.local`. A full run takes about 6 minutes.

Everything runs against the local API, never production: the script writes the local URL
to `.env.development.local` before Metro starts and refuses to run if Metro does not serve
it. An API already running on :3000 is reused, and must have been started with
`RATE_LIMIT_ENABLED=false` (the summary says so when sign-in requests were rate limited);
without one, the script starts it. Set `IOS_SIMULATOR` for another simulator name.

What the flows cover:

| Flow | Checks |
| --- | --- |
| `settings-signed-out`, `sign-in-sheet`, `sign-in-invalid-email` | signed-out settings, sign-in sheet, malformed address |
| `event-original-language` | event 920 (Tibetan) lists TIB and EN tracks and the control reads "Tibetan + English" |
| `settings-language` | Language holds the Portuguese-tracks switch and the subtitle row; the choice shows as its value; Video playback exists |
| `publications-signed-out` | only the public editions are listed; the members-only ones are not |
| `signed-in/*` | sign in, sign out, signed-in settings |

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
