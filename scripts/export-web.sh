#!/usr/bin/env bash
# Build the web app and send its source maps to Sentry, so web errors show
# readable stack traces instead of minified ones.
#
# The upload needs SENTRY_AUTH_TOKEN (an organization token from padmakarapt on
# sentry.io), read from the environment or from .env.local. Without it the build
# still succeeds and only the upload is skipped. The .map files are removed
# afterwards so the original sources are not served publicly.
#
# The build goes to dist-next/ and replaces dist/ only once it is complete, so the
# site keeps serving the previous version while it builds instead of a half-empty
# dist/. The previous builds' hashed scripts are carried over: a tab opened before
# the deploy still loads the pieces it fetches on demand (the PDF viewer, for one)
# instead of failing on a file that no longer exists.
set -euo pipefail

cd "$(dirname "$0")/.."

export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://api.padmakara.pt/api}"

# Hashed scripts older than this are dropped when carried over.
KEEP_OLD_ASSETS_DAYS=30

rm -rf dist-next dist-old

# --clear: Metro's cache keeps values inlined by an earlier export, so a past run
# without EXPO_PUBLIC_API_URL can ship a bundle that calls localhost.
npx expo export -p web --source-maps --clear --output-dir dist-next

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
if [ -d dist ]; then mv dist dist-old; fi
mv dist-next dist
rm -rf dist-old
echo "Web export done: dist/ replaced."
