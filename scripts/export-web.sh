#!/usr/bin/env bash
# Build the web app into dist/ and send its source maps to Sentry, so web errors
# show readable stack traces instead of minified ones.
#
# The upload needs SENTRY_AUTH_TOKEN (an organization token from padmakarapt on
# sentry.io), read from the environment or from .env.local. Without it the build
# still succeeds and only the upload is skipped. The .map files are removed from
# dist/ afterwards so the original sources are not served publicly.
set -euo pipefail

cd "$(dirname "$0")/.."

export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://api.padmakara.pt/api}"

# --clear: Metro's cache keeps values inlined by an earlier export, so a past run
# without EXPO_PUBLIC_API_URL can ship a bundle that calls localhost.
npx expo export -p web --source-maps --clear

if ! grep -qF "$EXPO_PUBLIC_API_URL" dist/_expo/static/js/web/entry-*.js; then
  echo "ERROR: the bundle does not contain $EXPO_PUBLIC_API_URL. Do not serve this dist/." >&2
  exit 1
fi

if npx sentry-expo-upload-sourcemaps dist; then
  echo "Source maps uploaded to Sentry."
else
  echo "WARNING: source maps were not uploaded to Sentry (is SENTRY_AUTH_TOKEN set?)." >&2
fi

find dist -name '*.map' -type f -delete
