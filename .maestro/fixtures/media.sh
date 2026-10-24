#!/usr/bin/env bash
# Makes the fixture media and puts it where the local API looks for it. LOCAL ONLY.
#
#   media.sh <cache-dir>     generate (once) into <cache-dir>, then upload the audio to MinIO
#
# - audio: two 90 s mp3 tones -> MinIO bucket padmakara-local, under the keys seed.sql names
# - video: a 90 s HLS whose picture spells the playback second in binary -> <cache-dir>/hls/e2e-fixture-video, served by
#   cdn-server.ts (the API only knows Bunny, over https, so the CDN stand-in has to be https)
# - tls:   a throwaway CA + a localhost certificate -> <cache-dir>/tls (the CA is trusted by
#   the simulator and the API in run-all.sh)
set -euo pipefail
cache="${1:?usage: media.sh <cache-dir>}"
minio="${E2E_MINIO_URL:-http://localhost:9000}"
bucket="padmakara-local"
mkdir -p "$cache/audio" "$cache/hls/e2e-fixture-video/360p" "$cache/tls"

command -v ffmpeg >/dev/null || { echo "media.sh: ffmpeg is required (brew install ffmpeg)" >&2; exit 1; }
command -v openssl >/dev/null || { echo "media.sh: openssl is required" >&2; exit 1; }

if [ ! -f "$cache/audio/001-fixture-track-one.mp3" ]; then
  ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=330:duration=90" -c:a libmp3lame -b:a 64k "$cache/audio/001-fixture-track-one.mp3"
  ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=440:duration=90" -c:a libmp3lame -b:a 64k "$cache/audio/002-fixture-track-two.mp3"
fi

# The picture is eight black/white columns spelling the playback second in binary (leftmost
# column = 1, then 2, 4, ... 128), so a flow can read the player's position from a screenshot
# (control-server.ts, GET /video/seconds): the player shows no clock of its own.
video_version="clock-bits-1"
if [ ! -f "$cache/hls/.version-$video_version" ]; then
  find "${cache:?}/hls" -type f -delete
  mkdir -p "$cache/hls/e2e-fixture-video/360p"
  ffmpeg -loglevel error -y -f lavfi -i "color=c=black:size=640x360:rate=25:duration=90" \
    -f lavfi -i "sine=frequency=220:duration=90" \
    -vf "geq=lum='255*mod(floor(floor(T)/pow(2,floor(X/80))),2)':cb=128:cr=128,format=yuv420p" \
    -c:v libx264 -preset veryfast -b:v 1500k -g 50 -keyint_min 50 -sc_threshold 0 -c:a aac -b:a 64k \
    -f hls -hls_time 5 -hls_playlist_type vod \
    -hls_segment_filename "$cache/hls/e2e-fixture-video/360p/seg%03d.ts" \
    "$cache/hls/e2e-fixture-video/360p/video.m3u8"
  cat > "$cache/hls/e2e-fixture-video/playlist.m3u8" <<'M3U'
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1700000,RESOLUTION=640x360
360p/video.m3u8
M3U
  touch "$cache/hls/.version-$video_version"
fi

# Renewed when it is about to expire (the CA is trusted again by run-all.sh on every run).
if [ -f "$cache/tls/server.pem" ] && ! openssl x509 -checkend 86400 -noout -in "$cache/tls/server.pem" >/dev/null 2>&1; then
  find "${cache:?}/tls" -type f -delete
fi
if [ ! -f "$cache/tls/server.pem" ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=Padmakara e2e CA" \
    -keyout "$cache/tls/ca.key" -out "$cache/tls/ca.pem" >/dev/null 2>&1
  openssl req -newkey rsa:2048 -nodes -subj "/CN=localhost" -keyout "$cache/tls/server.key" \
    -out "$cache/tls/server.csr" >/dev/null 2>&1
  printf 'subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n' > "$cache/tls/ext.cnf"
  openssl x509 -req -in "$cache/tls/server.csr" -CA "$cache/tls/ca.pem" -CAkey "$cache/tls/ca.key" \
    -CAcreateserial -days 30 -extfile "$cache/tls/ext.cnf" -out "$cache/tls/server.pem" >/dev/null 2>&1
fi

# MinIO: create the bucket (idempotent) and upload the audio, signed with curl's SigV4.
s3() { curl -sS -f --aws-sigv4 "aws:amz:us-east-1:s3" --user "minioadmin:minioadmin" "$@"; }
s3 -o /dev/null -X PUT "$minio/$bucket" 2>/dev/null || true
for f in "$cache"/audio/*.mp3; do
  s3 -o /dev/null -X PUT -H "Content-Type: audio/mpeg" --data-binary "@$f" "$minio/$bucket/events/E2E-FIXTURE/$(basename "$f")"
done
echo "media.sh: fixture media ready"
