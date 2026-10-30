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

npx expo export -p web --source-maps

if npx sentry-expo-upload-sourcemaps dist; then
  echo "Source maps uploaded to Sentry."
else
  echo "WARNING: source maps were not uploaded to Sentry (is SENTRY_AUTH_TOKEN set?)." >&2
fi

find dist -name '*.map' -type f -delete
