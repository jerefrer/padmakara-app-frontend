#!/usr/bin/env bash
# Publish a web build that is already in dist-next/ (with its .map files): send the
# source maps to Sentry, drop the .map files, carry over the previous builds' hashed
# scripts and swap dist-next/ in place of dist/. Runs on the server, where Caddy
# serves dist/ and where the Sentry token lives.
#
# dist-next/ comes either from scripts/deploy-web.sh (built on a Mac, then copied
# here) or from scripts/export-web.sh (built on this machine).
#
# The upload needs SENTRY_AUTH_TOKEN (an organization token from padmakarapt on
# sentry.io), read from the environment or from .env.local. Without it the site is
# still published and only the upload is skipped. The .map files are removed so the
# original sources are not served publicly.
#
# The previous builds' hashed scripts are carried over: a tab opened before the
# deploy still loads the pieces it fetches on demand (the PDF viewer, for one)
# instead of failing on a file that no longer exists.
set -euo pipefail

cd "$(dirname "$0")/.."

EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://api.padmakara.pt/api}"

# Hashed scripts older than this are dropped when carried over.
KEEP_OLD_ASSETS_DAYS=30

if [ ! -d dist-next/_expo/static/js/web ]; then
  echo "ERROR: dist-next/ holds no web build. dist/ was left as it was." >&2
  exit 1
fi

if ! grep -qF "$EXPO_PUBLIC_API_URL" dist-next/_expo/static/js/web/entry-*.js; then
  echo "ERROR: the bundle does not contain $EXPO_PUBLIC_API_URL. dist/ was left as it was." >&2
  exit 1
fi

if npx sentry-expo-upload-sourcemaps dist-next; then
  echo "Source maps uploaded to Sentry."
else
  echo "WARNING: source maps were not uploaded to Sentry (is SENTRY_AUTH_TOKEN set?)." >&2
fi

find dist-next -name '*.map' -type f -delete

# Carry over the previous builds' hashed scripts (never overwriting the new ones).
if [ -d dist/_expo/static ]; then
  (cd dist && find _expo/static -type f -mtime "-$KEEP_OLD_ASSETS_DAYS" ! -name '*.map' -print0) |
    while IFS= read -r -d '' file; do
      if [ ! -e "dist-next/$file" ]; then
        mkdir -p "dist-next/$(dirname "$file")"
        cp -p "dist/$file" "dist-next/$file"
      fi
    done
fi

# Swap: two renames, so dist/ is missing only for an instant.
rm -rf dist-old
if [ -d dist ]; then mv dist dist-old; fi
mv dist-next dist
rm -rf dist-old
echo "Web export done: dist/ replaced."
