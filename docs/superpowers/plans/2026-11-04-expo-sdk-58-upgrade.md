# Expo SDK 54 → 58 Upgrade Plan

**Goal:** move the app to Expo SDK 58 (React Native 0.88) before the public launch, with playback, lock screen, sign-in and the web app working as they do today.

**Why now:** SDK 54 no longer gets fixes (critical fixes only ended with the next SDK release, autumn 2026). Local iOS builds are impossible: Xcode 27 cannot compile SDK 54's `ExpoModulesCore` and has no Simulator.app, which `expo run:ios` looks for. Apple periodically raises the required SDK for submissions (date for the iOS 27 SDK not checked). Doing it while only internal testers are affected is the cheap moment.

**Estimate:** 2 to 3 sessions, plus a round of testing by André.

**Sources:** expo.dev/changelog/sdk-55 to sdk-58, docs.expo.dev/versions/latest, `bundledNativeModules.json` of expo@58.0.23, expo-audio@58.0.10. Impact counts measured on main on 2026-11-04.

## Decision needed before starting

**Minimum iOS rises from 15.1 to 16.4** (from SDK 56). iPhone 7, iPhone SE (1st gen) and iPad Air 2 can no longer install new versions. The audience is mostly 40+, sometimes on older devices. Staying on SDK 55 would keep iOS 15.1 but keeps most of the debt, so the recommendation is to accept 16.4. Jérémy and André decide; Apple's App Store Connect analytics show the installed iOS versions once the app is public.

## Global constraints

- Work on one branch, `chore/expo-sdk-58`, in a worktree. Nothing reaches main until step 6 passes.
- Never expose subscription wording or payment links in the native UI (Apple reader rules).
- EAS builds are launched from the main checkout only (the Play key lives in `secrets/`).
- Store builds need Jérémy's go.
- Baselines to hold: `npx jest --no-watchman` all green, `npx tsc --noEmit` no more than today's 12 errors.

## What stays risky (test these by hand, tests cannot see them)

1. Background playback with the screen locked: no `cpu_resource_fatal` on iOS, no `ForegroundServiceStartNotAllowedException` on Android.
2. Lock-screen player across automatic track changes, with title and speaker photo up to date, on both platforms.
3. Android release build under R8 (now on by default): libraries using reflection can fail only in release.
4. Video fullscreen and rotation on iOS 27 (`ScreenOrientation.lockAsync` may have no effect).
5. Passkey sign-in and offline downloads, which depend on third-party native modules.

## Measured impact

| Change | Where it hits us | Action |
|---|---|---|
| `expo-router` drops react-navigation (56, reworked in 58) | `components/HapticTab.tsx`, `components/ui/TabBarBackground.ios.tsx`, `@react-navigation/*` in package.json | Run the codemod `sdk-56-expo-router-react-navigation-replace`, then fix by hand |
| `newArchEnabled`, `edgeToEdgeEnabled` removed (55) | `app.config.ts:128`, `:170` | Delete |
| Precompiled Expo modules on iOS by default (56) | `patches/expo-audio+1.1.1.patch` also edits `ios/MediaController.swift`, which a precompiled module would ignore | Check if the iOS part is still needed; otherwise opt out for expo-audio |
| Prebuilt modules on Android | Same patch, `expo.autolinking.android.buildFromSource` in package.json | Keep and verify the class in the dex, as on 2026-11-03 |
| expo-audio 1.1 → 58 | Seek intervals are now options (`seekForwardIntervalSeconds`); no `artworkData` upstream | Drop the 15 s part of the patch; port the full-resolution artwork part. Re-check `updateMetadataInternal` still avoids restarting the service |
| Slider 5.0.1 → 5.2.1 | `patches/@react-native-community+slider+5.0.1.patch` (iOS 26 thumbless) | Check if upstream exposes `sliderStyle`, else re-port |
| `expo` no longer depends on `@expo/vector-icons` (56) | 52 files | Add it to package.json; migrating to `@react-native-vector-icons` is out of scope |
| `expo-file-system/legacy` | 10 files | Still shipped in 58 (checked); no change, `File` API not used |
| Hermes v1 default (56) | Whole app | Use expo ≥ 57.0.17 fixes (58 includes them); compare memory and startup |
| Reanimated 4.1 → 4.7, worklets 0.5 → 0.13, gesture-handler 2.28 → 3.3 (major) | Scrub bar in `AudioPlayer`, gestures | Retest scrubbing on Android, including the release handoff |
| Sentry 7.2 → 8.28 (major) | `app/_layout.tsx`, source-map upload in `scripts/export-web.sh` | Follow its migration guide, send a test report |
| `expo/fetch` becomes global fetch (56) | `apiService`, streaming | Retest refresh-token and upload-free paths |
| Scene life cycle default (58), R8 default (58) | Native config, `plugins/` config plugins | Retest splash, lock, deep links; add keep rules if needed |
| Web: async routes on by default, server output default (58) | `web.output: "static"` is already explicit | Set `asyncRoutes: { web: false }`, deploy later than native only after checking the sign-in page |
| Strict TypeScript API (58) | Ref types; no deep imports found | Fix, or use the temporary `customConditions` opt-out |
| `allowsFullscreen` removed (55) | 1 file (`expo-video`) | `fullscreenOptions.enable` |
| Not managed by Expo | `react-native-passkey` 3.6.2 (Sept 2026), `react-native-blob-util` 0.25.1 (Sept 2026), `react-pdf` 11 | Update; test on real devices. `react-native-slider` looks unused: confirm and remove |

Not affected (checked): `InteractionManager`, deep `react-native/Libraries` imports, `expo-av` (only a comment), `experimentalBlurMethod`, `withLayoutContext`.

## Tasks

One SDK at a time, as Expo recommends, one commit per SDK. At each step: `npx expo install expo@^NN.0.0 --fix`, `npx expo-doctor@latest`, jest, tsc, delete generated `android/` and `ios/`.

### Task 1: SDK 55 (React Native 0.83)
Remove `newArchEnabled` and `edgeToEdgeEnabled`, replace `allowsFullscreen`, handle `androidStatusBar` and `androidNavigationBar` deprecations.
Passes when: jest, tsc and web export pass.

### Task 2: SDK 56 (React Native 0.85, router without react-navigation)
Router codemod, add `@expo/vector-icons`, raise podspec targets if any, decide precompiled modules for expo-audio.
Passes when: as above, plus tab bar, event screen and back navigation work in a web export.

### Task 3: SDK 57 (React Native 0.86)
Bump Reanimated, worklets and gesture handler. Take expo ≥ 57.0.23.
Passes when: as above.

### Task 4: SDK 58 (React Native 0.88)
Strict TypeScript, scene life cycle, web router options.
Passes when: jest, tsc, `expo-doctor` clean and web export pass.

### Task 5: Re-port native patches
Rebuild `patches/` against expo-audio 58 and slider 5.2.1, dropping what upstream now covers. Update `__mocks__/expo-audio.ts` if the API moved; keep its finish status aligned with the native players (`playing: false`, `didJustFinish: true`).
Passes when: `AudioPlayerContext` tests pass and the patch applies on a clean install.

### Task 6: Real-device verification
Local release builds on the Galaxy (adb) and the iPhone (Xcode 27 with `-allowProvisioningDeviceRegistration`, install with `devicectl`). Walk through "What stays risky", read `idevicecrashreport` and `adb logcat`, and capture the lock screen on both.
Passes when: every item holds for 10 locked minutes across at least two automatic track changes.

### Task 7: Ship
Merge, deploy web, then EAS builds from the main checkout after Jérémy's go. André tests in TestFlight and internal testing.
Passes when: no new Sentry issues after his round. Remove the Xcode workarounds from the notes.

## Rollback

The branch merges only after Task 6. If a problem appears after shipping, the previous TestFlight and Play builds remain installable and main can be reverted with one merge revert; the API is not touched by this work.
