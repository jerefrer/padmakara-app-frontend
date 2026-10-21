#!/usr/bin/env bash
# One command before every TestFlight / store build: runs every Maestro flow against the
# local API and exits non-zero unless all of them pass.
#
#   npm run e2e                 iOS simulator (default)
#   npm run e2e:android         Android emulator
#   npm run e2e:all             both, one after the other
#   .maestro/run-all.sh --platform ios|android|all
#
# It checks the prerequisites, starts what is missing (simulator or emulator, Metro, the
# local API) and stops only what it started. It always points the app at the LOCAL API
# through .env.development.local, which it removes on exit, and refuses to run if Metro
# does not serve that URL: no flow can talk to production.
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
app="$(dirname "$here")"
api_dir="$(cd "$app/../padmakara-api" 2>/dev/null && pwd || true)"
local_env="$app/.env.development.local"
local_url="http://localhost:3000/api"
bundle_ios="http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app"
app_id="org.padmakara.pt"
ios_name="${IOS_SIMULATOR:-iPhone 16}"
android_avd="${ANDROID_AVD:-Medium_Phone_API_35}"
android_sdk="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
adb="$android_sdk/platform-tools/adb"
platform="ios"

while [ $# -gt 0 ]; do
  case "$1" in
    --platform) platform="${2:-}"; shift 2 ;;
    --platform=*) platform="${1#*=}"; shift ;;
    *) echo "Unknown option: $1 (usage: run-all.sh [--platform ios|android|all])" >&2; exit 2 ;;
  esac
done
case "$platform" in ios | android | all) ;; *) echo "--platform must be ios, android or all" >&2; exit 2 ;; esac

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export PATH="$JAVA_HOME/bin:$PATH"

work="$(mktemp -d "${TMPDIR:-/tmp}/padmakara-e2e.XXXXXX")"
created_env=false
started_metro=""
started_api=""
booted_sim=""
started_emulator=false
results=()
failed=0
t_start=$SECONDS

die() { echo "e2e: $*" >&2; exit 1; }

cleanup() {
  # npx and bun spawn children: stop whatever listens on the port we started a server on.
  if [ -n "$started_metro" ]; then kill $(lsof -tiTCP:8081 -sTCP:LISTEN) 2>/dev/null; fi
  if [ -n "$started_api" ]; then kill $(lsof -tiTCP:3000 -sTCP:LISTEN) 2>/dev/null; fi
  if [ -n "$booted_sim" ]; then xcrun simctl shutdown "$booted_sim" 2>/dev/null; fi
  if [ "$started_emulator" = true ]; then "$adb" emu kill >/dev/null 2>&1; fi
  if [ "$created_env" = true ]; then rm -f "$local_env"; fi
  rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# --- Prerequisites ---------------------------------------------------------------------
command -v maestro >/dev/null || die "maestro is not installed (brew install mobile-dev-inc/tap/maestro)"
[ -x "$JAVA_HOME/bin/java" ] || die "JAVA_HOME ($JAVA_HOME) has no java (brew install openjdk@17)"
[ -n "$api_dir" ] || die "padmakara-api is not next to padmakara-app"

# Everything, signed out or in, runs against the local API. Written before Metro starts.
if [ -e "$local_env" ]; then
  grep -qx "EXPO_PUBLIC_API_URL=$local_url" "$local_env" ||
    die "$local_env exists and does not point to $local_url"
else
  echo "EXPO_PUBLIC_API_URL=$local_url" > "$local_env"
  created_env=true
fi

# Local API on :3000. Reuse a running one (and read its log), else start one.
if curl -sf -o /dev/null "http://localhost:3000/api/events/public"; then
  if [ -z "${API_LOG:-}" ]; then
    pid="$(lsof -tiTCP:3000 -sTCP:LISTEN | head -n1)"
    API_LOG="$(lsof -p "$pid" -a -d 1 -Fn 2>/dev/null | sed -n 's/^n//p' | head -n1)"
  fi
  [ -f "${API_LOG:-}" ] ||
    die "the API on :3000 does not log to a file I can find: set API_LOG=<its output file> or stop it and let me start one"
else
  API_LOG="$work/api.log"
  (cd "$api_dir" && RATE_LIMIT_ENABLED=false exec bun run dev > "$API_LOG" 2>&1) &
  started_api=$!
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "http://localhost:3000/api/events/public" && break
    sleep 1
  done
  curl -sf -o /dev/null "http://localhost:3000/api/events/public" || die "the local API did not start (see $API_LOG)"
fi
export API_LOG
# The flows need the seeded teaching (event 920) of the local database.
curl -sf "http://localhost:3000/api/events/public" | grep -q '"id":920' ||
  die "the local database has no public event 920 (the flows search for it)"
api_log_start=$(wc -l < "$API_LOG")
echo "e2e: local API ok, log $API_LOG"

# Metro, in dev-client mode with file watching (CI=1 would serve a stale bundle).
if ! curl -sf http://localhost:8081/status | grep -q running; then
  (cd "$app" && exec npx expo start --dev-client --port 8081 > "$work/metro.log" 2>&1) &
  started_metro=$!
  for _ in $(seq 1 90); do
    curl -sf http://localhost:8081/status | grep -q running && break
    sleep 1
  done
  curl -sf http://localhost:8081/status | grep -q running || die "Metro did not start (see $work/metro.log)"
fi
# The first bundle takes a while; save it to a file rather than piping into grep -q (which
# would close the pipe early and fail under pipefail).
serves_local_env() {
  curl -sf -m 300 "$bundle_ios" -o "$work/bundle.js" && grep -q '"\.env\.development\.local")' "$work/bundle.js"
}
serves_local_env || serves_local_env ||
  die "Metro does not serve $local_env: refusing to run (it could reach production)"
echo "e2e: Metro ok, serving the local API URL"

# --- Devices ---------------------------------------------------------------------------
ios_udid=""
prepare_ios() {
  command -v xcrun >/dev/null || die "Xcode command line tools are missing"
  ios_udid="$(xcrun simctl list devices available | grep -F "$ios_name (" | head -n1 | grep -oE '[0-9A-F-]{36}')"
  [ -n "$ios_udid" ] || die "no simulator named '$ios_name' (set IOS_SIMULATOR)"
  if ! xcrun simctl list devices | grep "$ios_udid" | grep -q Booted; then
    xcrun simctl boot "$ios_udid" || die "could not boot the simulator"
    booted_sim="$ios_udid"
  fi
  xcrun simctl bootstatus "$ios_udid" >/dev/null 2>&1
  if ! xcrun simctl get_app_container "$ios_udid" "$app_id" >/dev/null 2>&1; then
    local built="$app/ios/build/DerivedData/Build/Products/Debug-iphonesimulator/Padmakara.app"
    [ -d "$built" ] || die "the dev client is not installed and not built: see .maestro/README.md (One-time setup)"
    xcrun simctl install "$ios_udid" "$built" || die "could not install the dev client"
  fi
}

android_serial=""
prepare_android() {
  [ -x "$adb" ] || die "adb not found in $android_sdk (set ANDROID_HOME)"
  if ! "$adb" devices | grep -qE '^emulator-[0-9]+[[:space:]]+device'; then
    "$android_sdk/emulator/emulator" -avd "$android_avd" -no-window -no-audio -no-boot-anim -no-snapshot-save \
      > "$work/emulator.log" 2>&1 &
    started_emulator=true
    "$adb" wait-for-device
    for _ in $(seq 1 180); do
      [ "$("$adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
      sleep 2
    done
    [ "$("$adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] || die "the emulator did not finish booting"
  fi
  android_serial="$("$adb" devices | grep -oE '^emulator-[0-9]+' | head -n1)"
  "$adb" -s "$android_serial" reverse tcp:8081 tcp:8081 >/dev/null
  "$adb" -s "$android_serial" reverse tcp:3000 tcp:3000 >/dev/null
  if ! "$adb" -s "$android_serial" shell pm list packages "$app_id" | grep -q "package:$app_id\$"; then
    local apk="$app/android/app/build/outputs/apk/debug/app-debug.apk"
    [ -f "$apk" ] || die "the Android dev client is not installed and not built: see .maestro/README.md (Android)"
    "$adb" -s "$android_serial" install -r "$apk" >/dev/null || die "could not install the dev client"
  fi
}

# --- Flows -----------------------------------------------------------------------------
run_flows() {
  local label="$1" udid="$2" start flow rc
  # Signed-out flows first, then every signed-in flow through run-signed-in.sh.
  for flow in "$here"/*.yaml; do
    start=$SECONDS
    echo; echo "e2e: [$label] $(basename "$flow")"
    maestro test --udid "$udid" "$flow"; rc=$?
    results+=("$([ $rc -eq 0 ] && echo PASS || echo FAIL)  $label  $(basename "$flow")  $((SECONDS - start))s")
    [ $rc -eq 0 ] || failed=$((failed + 1))
  done
  for flow in "$here"/signed-in/*.yaml; do
    start=$SECONDS
    echo; echo "e2e: [$label] signed-in/$(basename "$flow")"
    "$here/run-signed-in.sh" --udid "$udid" "$flow"; rc=$?
    results+=("$([ $rc -eq 0 ] && echo PASS || echo FAIL)  $label  signed-in/$(basename "$flow")  $((SECONDS - start))s")
    [ $rc -eq 0 ] || failed=$((failed + 1))
  done
}

if [ "$platform" = ios ] || [ "$platform" = all ]; then
  prepare_ios; run_flows ios "$ios_udid"
fi
if [ "$platform" = android ] || [ "$platform" = all ]; then
  prepare_android; run_flows android "$android_serial"
fi

echo
echo "e2e summary"
printf '  %s\n' "${results[@]}"
if [ "$failed" -ne 0 ] && tail -n "+$((api_log_start + 1))" "$API_LOG" | grep -q 'request-magic-link.* 429'; then
  echo "e2e: the API rate-limited the sign-in requests: restart it with RATE_LIMIT_ENABLED=false (bun run dev)." >&2
fi
echo "e2e: $((${#results[@]} - failed))/${#results[@]} flows passed in $((SECONDS - t_start))s"
if [ "$failed" -ne 0 ]; then
  echo "e2e: FAILED. Do not ship a build until this is green." >&2
  exit 1
fi
echo "e2e: green."
