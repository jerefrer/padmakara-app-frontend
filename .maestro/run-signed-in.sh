#!/usr/bin/env bash
# Runs the signed-in flows against the local API, standing in for the person who opens
# the magic link: the dev API prints each activation link to its log instead of emailing
# it, and this script opens every new one while Maestro waits on the sign-in sheet.
#
# Usage: API_LOG=path/to/api.log .maestro/run-signed-in.sh [maestro test options] [flows]
# Needs the local API with rate limiting off, since every flow signs in with the same
# address (RATE_LIMIT_ENABLED=false bun run dev, output in API_LOG), and Metro
# (npx expo start --dev-client, with file watching, so not CI=1).
#
# In development the bundle reads EXPO_PUBLIC_API_URL from the .env files themselves
# (expo/virtual/env), so a shell variable cannot override .env, which points to
# production. The script writes the local URL to .env.development.local, which wins
# over every other .env file, and removes it when the run ends.
set -euo pipefail

: "${API_LOG:?Set API_LOG to the file the local API (bun run dev) writes its output to}"
[ -f "$API_LOG" ] || { echo "No such API log: $API_LOG" >&2; exit 1; }

here="$(cd "$(dirname "$0")" && pwd)"
app="$(dirname "$here")"
local_env="$app/.env.development.local"
local_url="http://localhost:3000/api"
bundle="http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app"

created_env=false
watcher=""
cleanup() {
  [ -n "$watcher" ] && kill "$watcher" 2>/dev/null
  if [ "$created_env" = true ]; then rm -f "$local_env"; fi
}
trap cleanup EXIT

if [ -e "$local_env" ]; then
  grep -qx "EXPO_PUBLIC_API_URL=$local_url" "$local_env" || {
    echo "Refusing to run: $local_env exists and does not point to $local_url." >&2
    exit 1
  }
else
  echo "EXPO_PUBLIC_API_URL=$local_url" > "$local_env"
  created_env=true
fi

# Never run against production: wait until Metro serves the local URL. The bundle goes to a
# file: grep -q on a pipe closes it early, which pipefail turns into a failure.
bundle_file="$(mktemp "${TMPDIR:-/tmp}/padmakara-bundle.XXXXXX")"
serves_local_env() {
  curl -sf -m 300 "$bundle" -o "$bundle_file" && grep -q '"\.env\.development\.local")' "$bundle_file"
}
ok=false
for _ in $(seq 1 15); do
  if serves_local_env; then ok=true; break; fi
  sleep 2
done
rm -f "$bundle_file"
[ "$ok" = true ] || {
  echo "Refusing to run: Metro has not picked up $local_env." >&2
  exit 1
}

start_line=$(wc -l < "$API_LOG")

# Only the indented line the API prints under "DEV: Click to activate device": its
# request log repeats the link once opened.
links() {
  tail -n "+$((start_line + 1))" "$API_LOG" | grep -E '^  http://[^ ]+/api/auth/activate/' | tr -d ' ' || true
}

open_new_links() {
  local opened=0
  while true; do
    local all count
    all="$(links)"
    count=$(printf '%s' "$all" | grep -c . || true)
    if [ "$count" -gt "$opened" ]; then
      # Let the app show its "link sent" state first: opening the link at once closes the
      # sheet before the flow has asserted it.
      sleep 3
      printf '%s\n' "$all" | tail -n "+$((opened + 1))" | while read -r url; do
        curl -s -o /dev/null "$url" && echo "opened magic link ${url%%\?*}" >&2
      done
      opened=$count
    fi
    sleep 1
  done
}

open_new_links &
watcher=$!

# Without a flow or folder among the arguments, run every signed-in flow.
has_flows=false
for arg in "$@"; do
  case "$arg" in *.yaml | */signed-in | */signed-in/) has_flows=true ;; esac
done
if [ "$has_flows" = false ]; then set -- "$@" "$here/signed-in"; fi
maestro test "$@"
