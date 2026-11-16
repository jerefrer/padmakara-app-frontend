#!/usr/bin/env bash
# Deploy the web app (app.padmakara.pt): build on this Mac, publish on the server.
#
# The build is the heavy part (about a minute here, about 5 minutes of full CPU on
# the server's 2 cores, next to the API). So it runs here, the result is copied to
# the server's dist-next/, and the server only runs scripts/publish-web.sh: the
# Sentry upload (the token stays on the server), the carry-over of old scripts and
# the swap.
#
# It refuses to build anything but what is on origin/main: a clean working tree,
# at exactly origin/main. The server's checkout is brought to the same commit
# first, so the published site and the server's scripts always match.
#
#   npm run deploy:web
set -euo pipefail

cd "$(dirname "$0")/.."

SERVER="${DEPLOY_SERVER:-padmakara@admin.padmakara.pt}"
REMOTE_DIR="padmakara-app"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://api.padmakara.pt/api}"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "ERROR: the working tree has uncommitted changes. Commit and push first." >&2
  exit 1
fi
git fetch --quiet origin main
HEAD_SHA="$(git rev-parse HEAD)"
if [ "$HEAD_SHA" != "$(git rev-parse origin/main)" ]; then
  echo "ERROR: HEAD is not origin/main. Only what is pushed to main is deployed." >&2
  exit 1
fi

echo "[1/4] Bringing the server's checkout to $(git rev-parse --short HEAD)..."
ssh -n "$SERVER" "cd $REMOTE_DIR && git pull --ff-only --quiet origin main && test \"\$(git rev-parse HEAD)\" = $HEAD_SHA"

echo "[2/4] Building..."
rm -rf dist-next
# --clear: Metro's cache keeps values inlined by an earlier export, so a past run
# without EXPO_PUBLIC_API_URL can ship a bundle that calls localhost.
npx expo export -p web --source-maps --clear --output-dir dist-next
if ! grep -qF "$EXPO_PUBLIC_API_URL" dist-next/_expo/static/js/web/entry-*.js; then
  echo "ERROR: the bundle does not contain $EXPO_PUBLIC_API_URL. Nothing was sent." >&2
  exit 1
fi

echo "[3/4] Copying the build to the server..."
rsync -az --delete dist-next/ "$SERVER:$REMOTE_DIR/dist-next/"
rm -rf dist-next

echo "[4/4] Publishing on the server..."
ssh -n "$SERVER" "cd $REMOTE_DIR && scripts/publish-web.sh"
