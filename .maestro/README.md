# Native UI flows (Maestro)

End-to-end checks of the iOS app, run on a simulator with no window: nothing takes
the focus on the Mac. They drive the development build (`expo-dev-client`), not Expo Go.

The flows only read public screens and never send a magic link, so they are safe
against the production API that `.env` points to.

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

## Run

```bash
xcrun simctl boot "iPhone 16"                  # headless: do not open Simulator.app
xcrun simctl install "iPhone 16" ios/build/DerivedData/Build/Products/Debug-iphonesimulator/Padmakara.app
npx expo start --dev-client                    # keep running; not CI=1, which stops file watching
JAVA_HOME=/opt/homebrew/opt/openjdk@17 maestro test .maestro
```

`subflows/launch.yaml` starts from a fresh install, opens the local Metro server from
the dev launcher and closes the dev menu that introduces itself on first launch.

If a run is interrupted on an iOS "Open in Padmakara?" dialog, restart the simulator
(`xcrun simctl shutdown` then `boot`): the system dialog outlives the app.
