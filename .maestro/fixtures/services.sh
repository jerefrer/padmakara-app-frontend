#!/usr/bin/env bash
# The local servers the media flows need, in one place so run-all.sh and the control server
# (control-server.ts, which the flows call to cut the network) start and stop them the same way.
# LOCAL ONLY: nothing here talks to production.
#
#   services.sh up        MinIO (:9000), the fixture media and rows, the CDN stand-in (:9443), the API (:3000)
#   services.sh down      stop all three servers
#   services.sh net-off   stop all three too (the app can reach nothing: the offline flow)
#   services.sh net-on    start the servers again, with the same data
#
# Environment (set by run-all.sh):
#   E2E_WORK       scratch directory (MinIO data, logs)
#   E2E_CACHE      fixture media and TLS files made by media.sh
#   E2E_API_DIR    padmakara-api checkout
#   E2E_API_LOG    file the API writes to (appended to, so the sign-in link watcher keeps its place)
#   E2E_DATABASE_URL  the LOCAL database (run-all.sh refuses anything else); the API is pinned to it
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
: "${E2E_WORK:?}" "${E2E_CACHE:?}" "${E2E_API_DIR:?}" "${E2E_API_LOG:?}" "${E2E_DATABASE_URL:?}"

listener() { lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null; }
stop_port() {
  local pids
  pids="$(listener "$1")"
  [ -n "$pids" ] && kill $pids 2>/dev/null
  for _ in $(seq 1 30); do [ -z "$(listener "$1")" ] && return 0; sleep 0.2; done
  pids="$(listener "$1")"
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null
  return 0
}
wait_for() { # <description> <command...>
  local what="$1"; shift
  for _ in $(seq 1 60); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done
  echo "services: $what did not come up" >&2; return 1
}

start_minio() {
  [ -z "$(listener 9000)" ] || { echo "services: port 9000 is busy" >&2; return 1; }
  mkdir -p "$E2E_WORK/minio-data"
  MINIO_UPDATE=off MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin \
    nohup minio server "$E2E_WORK/minio-data" --address :9000 --console-address 127.0.0.1:9101 \
    >> "$E2E_WORK/minio.log" 2>&1 &
  wait_for MinIO curl -sf http://localhost:9000/minio/health/live
}

start_cdn() {
  [ -z "$(listener 9443)" ] || { echo "services: port 9443 is busy" >&2; return 1; }
  nohup bun "$here/cdn-server.ts" "$E2E_CACHE/hls" "$E2E_CACHE/tls" 9443 >> "$E2E_WORK/cdn.log" 2>&1 &
  wait_for "the CDN stand-in" curl -sf --cacert "$E2E_CACHE/tls/ca.pem" https://localhost:9443/e2e-fixture-video/playlist.m3u8
}

# The API reads audio from MinIO and video from the CDN stand-in (whose CA it must trust).
start_api() {
  [ -z "$(listener 3000)" ] || { echo "services: port 3000 is busy" >&2; return 1; }
  (
    cd "$E2E_API_DIR" || exit 1
    DATABASE_URL="$E2E_DATABASE_URL" RATE_LIMIT_ENABLED=false NODE_EXTRA_CA_CERTS="$E2E_CACHE/tls/ca.pem" \
      S3_ENDPOINT=http://localhost:9000 S3_FORCE_PATH_STYLE=true S3_BUCKET=padmakara-local \
      STORAGE_ACCESS_KEY_ID=minioadmin STORAGE_SECRET_ACCESS_KEY=minioadmin STORAGE_REGION=us-east-1 \
      AWS_ACCESS_KEY_ID=minioadmin AWS_SECRET_ACCESS_KEY=minioadmin AWS_REGION=us-east-1 \
      BUNNY_STREAM_CDN_HOSTNAME=localhost:9443 BUNNY_STREAM_TOKEN_AUTH_KEY=e2e BUNNY_STREAM_LIBRARY_ID=1 \
      nohup bun run src/index.ts >> "$E2E_API_LOG" 2>&1 &
  )
  wait_for "the API" curl -sf http://localhost:3000/api/events/public
}

stop_all() { stop_port 3000; stop_port 9443; stop_port 9000; }

case "${1:-}" in
  up)
    start_minio || exit 1
    bash "$here/media.sh" "$E2E_CACHE" || exit 1
    psql "$E2E_DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$here/seed.sql" || exit 1
    start_cdn && start_api
    ;;
  net-on) start_minio && start_cdn && start_api ;;
  down | net-off) stop_all ;;
  *) echo "usage: services.sh up|down|net-off|net-on" >&2; exit 2 ;;
esac
