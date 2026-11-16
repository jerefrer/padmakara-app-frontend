#!/usr/bin/env bash
# Build the web app on this machine and publish it (scripts/publish-web.sh).
#
# The usual route is scripts/deploy-web.sh, which builds on a Mac and only
# publishes on the server: the server has 2 cores shared with the API, and an
# export there takes about 5 minutes of full CPU. This script stays as the
# fallback for building on the server itself.
#
# The build goes to dist-next/ and replaces dist/ only once it is complete, so the
# site keeps serving the previous version while it builds instead of a half-empty
# dist/.
set -euo pipefail

cd "$(dirname "$0")/.."

export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://api.padmakara.pt/api}"

rm -rf dist-next

# --clear: Metro's cache keeps values inlined by an earlier export, so a past run
# without EXPO_PUBLIC_API_URL can ship a bundle that calls localhost.
npx expo export -p web --source-maps --clear --output-dir dist-next

scripts/publish-web.sh
