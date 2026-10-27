#!/usr/bin/env bash
# One command before every TestFlight / store build: runs every Maestro flow against the
# local API and exits non-zero unless all of them pass.
#
#   npm run e2e                 iOS simulator (default)
#   npm run e2e:android         Android emulator
#   npm run e2e:all             both, one after the other
#   .maestro/run-all.sh --platform ios|android|all
#
# It checks the prerequisites, starts what is missing (simulator or emulator, Metro) plus the
# local servers of the media flows (MinIO, a CDN stand-in, the API: see fixtures/) and stops
# only what it started. It always points the app at the LOCAL API
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
ios_name="${IOS_SIMULATOR:-iPhone 17 Pro}"
android_avd="${ANDROID_AVD:-Medium_Phone_API_35}"
android_sdk="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
adb="$android_sdk/platform-tools/adb"
platform="ios"
suite="all"
shots_dir="${SHOTS_DIR:-}"
control_port=3999
fixtures="$here/fixtures"
cache="$fixtures/.cache"

while [ $# -gt 0 ]; do
  case "$1" in
    --platform) platform="${2:-}"; shift 2 ;;
    --platform=*) platform="${1#*=}"; shift ;;
    --suite) suite="${2:-}"; shift 2 ;;
    --suite=*) suite="${1#*=}"; shift ;;
    *) echo "Unknown option: $1 (usage: run-all.sh [--platform ios|android|all] [--suite all|ipad])" >&2; exit 2 ;;
  esac
done
case "$suite" in all | ipad) ;; *) echo "--suite must be all or ipad" >&2; exit 2 ;; esac
if [ "$suite" = ipad ]; then
  # The iPad tour: iOS only, on an iPad simulator, screenshots into SHOTS_DIR.
  platform="ios"
  ios_name="${IOS_SIMULATOR:-iPad Air 11-inch (M3)}"
  : "${shots_dir:=${TMPDIR:-/tmp}/ipad-shots}"
  mkdir -p "$shots_dir"
  export MAESTRO_SHOTS_DIR="$shots_dir"
fi
case "$platform" in ios | android | all) ;; *) echo "--platform must be ios, android or all" >&2; exit 2 ;; esac

# A first simulator boot often outlasts Maestro's default wait for its iOS driver.
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-240000}"
export MAESTRO_E2E_CONTROL_URL="http://127.0.0.1:$control_port"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export PATH="$JAVA_HOME/bin:$PATH"

work="$(mktemp -d "${TMPDIR:-/tmp}/padmakara-e2e.XXXXXX")"
created_env=false
started_metro=""
started_services=false
started_control=false
booted_sim=""
started_emulator=false
results=()
failed=0
t_start=$SECONDS

die() { echo "e2e: $*" >&2; exit 1; }

cleanup() {
  # npx and bun spawn children: stop whatever listens on the port we started a server on.
  if [ -n "$started_metro" ]; then kill $(lsof -tiTCP:8081 -sTCP:LISTEN) 2>/dev/null; fi
  if [ "$started_control" = true ]; then kill $(lsof -tiTCP:"$control_port" -sTCP:LISTEN) 2>/dev/null; fi
  if [ "$started_services" = true ]; then bash "$fixtures/services.sh" down >/dev/null 2>&1; fi
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
for tool in minio ffmpeg openssl psql bun curl; do
  command -v "$tool" >/dev/null || die "$tool is required by the media flows (brew install $tool; bun: brew install oven-sh/bun/bun)"
done

# The media flows write to the database (a fixture event, bookmarks): LOCAL ONLY.
database_url="$(grep -E '^DATABASE_URL=' "$api_dir/.env" 2>/dev/null | head -n1 | cut -d= -f2-)"
case "$database_url" in
  postgresql://*@localhost[:/]* | postgresql://*@127.0.0.1[:/]* | postgres://*@localhost[:/]* | postgres://*@127.0.0.1[:/]*) ;;
  *) die "DATABASE_URL in $api_dir/.env is not a local database: refusing to seed fixtures" ;;
esac

# Everything, signed out or in, runs against the local API. Written before Metro starts.
if [ -e "$local_env" ]; then
  grep -qx "EXPO_PUBLIC_API_URL=$local_url" "$local_env" ||
    die "$local_env exists and does not point to $local_url"
else
  echo "EXPO_PUBLIC_API_URL=$local_url" > "$local_env"
  created_env=true
fi

# The local servers: MinIO (audio), a CDN stand-in (video), the API wired to both, plus the
# fixture event they serve (fixtures/seed.sql, media.sh). The API is always started here, with
# that wiring: one already running on :3000 would not serve the fixture media.
for port in 3000 9000 9443 "$control_port"; do
  [ -z "$(lsof -tiTCP:"$port" -sTCP:LISTEN)" ] ||
    die "port $port is busy: stop what listens on it (the e2e run starts its own API on :3000 with local media)"
done
export E2E_WORK="$work" E2E_CACHE="$cache" E2E_API_DIR="$api_dir" E2E_DATABASE_URL="$database_url"
export E2E_SERVICES="$fixtures/services.sh"
API_LOG="$work/api.log"; export E2E_API_LOG="$API_LOG"; : > "$API_LOG"
started_services=true
bash "$fixtures/services.sh" up || die "the local servers did not start (see $work/*.log and $API_LOG)"
export API_LOG
# The flows need the seeded teaching (event 920) of the local database.
curl -sf "http://localhost:3000/api/events/public" | grep -q '"id":920' ||
  die "the local database has no public event 920 (the flows search for it)"
api_log_start=$(wc -l < "$API_LOG")
echo "e2e: local API, MinIO and CDN stand-in ok, log $API_LOG"

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
  # The video comes from an https stand-in for the CDN, signed by a throwaway CA.
  xcrun simctl keychain "$ios_udid" add-root-cert "$cache/tls/ca.pem" || die "could not trust the e2e CA in the simulator"
  # The control server lets the flows cut the network, match Face ID, read the database.
  E2E_UDID="$ios_udid" bun "$fixtures/control-server.ts" "$control_port" > "$work/control.log" 2>&1 &
  started_control=true
  for _ in $(seq 1 20); do curl -sf "http://127.0.0.1:$control_port/health" >/dev/null && break; sleep 0.5; done
  curl -sf "http://127.0.0.1:$control_port/health" >/dev/null || die "the control server did not start (see $work/control.log)"
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
# The flows that need the media fixtures, Face ID or the control server say so on a line of
# their own and are skipped on Android.
ios_only() { grep -q '^# e2e: ios-only' "$1"; }

# A flow that cuts the network puts it back itself; if it failed first, do it here.
ensure_servers() {
  curl -sf -o /dev/null "http://localhost:3000/api/events/public" && return 0
  echo "e2e: the local servers are down (a flow stopped early): starting them again"
  bash "$fixtures/services.sh" net-on || die "could not restart the local servers"
}

# Runs a maestro command, once more if (and only if) Maestro could not reach its iOS driver
# in time: that is the simulator's slow first boot, not a failing flow.
run_maestro() {
  local attempt rc log="$work/maestro.log"
  for attempt in 1 2; do
    "$@" 2>&1 | tee "$log"; rc=${PIPESTATUS[0]}
    [ $rc -eq 0 ] && return 0
    if [ "$attempt" -eq 1 ] && grep -qi "driver not ready in time" "$log"; then
      echo "e2e: Maestro's iOS driver was not ready in time: trying once more"
      continue
    fi
    return $rc
  done
}

run_flows() {
  local label="$1" udid="$2" start flow rc
  if [ "$suite" = ipad ]; then
    for flow in "$here"/ipad/tour.yaml; do
      start=$SECONDS
      echo; echo "e2e: [$label] ipad/$(basename "$flow")"
      ensure_servers
      run_maestro "$here/run-signed-in.sh" --udid "$udid" --test-output-dir "$MAESTRO_SHOTS_DIR" "$flow"; rc=$?
      results+=("$([ $rc -eq 0 ] && echo PASS || echo FAIL)  $label  ipad/$(basename "$flow")  $((SECONDS - start))s")
      [ $rc -eq 0 ] || failed=$((failed + 1))
    done
    return
  fi
  # Signed-out flows first, then every signed-in flow through run-signed-in.sh.
  for flow in "$here"/*.yaml; do
    start=$SECONDS
    echo; echo "e2e: [$label] $(basename "$flow")"
    ensure_servers
    run_maestro maestro test --udid "$udid" "$flow"; rc=$?
    results+=("$([ $rc -eq 0 ] && echo PASS || echo FAIL)  $label  $(basename "$flow")  $((SECONDS - start))s")
    [ $rc -eq 0 ] || failed=$((failed + 1))
  done
  for flow in "$here"/signed-in/*.yaml; do
    if [ "$label" = android ] && ios_only "$flow"; then
      results+=("SKIP  $label  signed-in/$(basename "$flow")  (iOS only)")
      continue
    fi
    start=$SECONDS
    echo; echo "e2e: [$label] signed-in/$(basename "$flow")"
    ensure_servers
    run_maestro "$here/run-signed-in.sh" --udid "$udid" "$flow"; rc=$?
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
skipped=$(printf '%s\n' "${results[@]}" | grep -c '^SKIP' || true)
ran=$((${#results[@]} - skipped))
echo "e2e: $((ran - failed))/$ran flows passed in $((SECONDS - t_start))s${skipped:+ ($skipped skipped on this platform)}"
if [ "$failed" -ne 0 ]; then
  echo "e2e: FAILED. Do not ship a build until this is green." >&2
  exit 1
fi
echo "e2e: green."
