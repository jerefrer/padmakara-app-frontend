/**
 * Detect expired AWS S3 presigned URLs inside cached API responses.
 *
 * Context: the client-side entity cache (services/entityCacheService.ts) is
 * designed without a TTL — entries are invalidated only by namespace version
 * mismatches (admin edits) or schema-version bumps. That works for entity
 * fields whose contents are stable (titles, descriptions, durations, ...)
 * but it leaks for any field whose value is itself ephemeral. The hero,
 * avatar and photo image URLs on teachers and retreat groups are AWS S3
 * presigned URLs with a 1-hour lifetime (`X-Amz-Expires=3600`); a cached
 * entry from yesterday has perfectly valid metadata but the embedded
 * `heroUrl` is long-dead and S3 returns 403 — which makes the hero render
 * as a grey box on web because expo-image's AnimationManager filters out
 * the errored node.
 *
 * The fix here: at cache READ time, scan the cached value for presigned
 * URLs and check whether any have already expired (or are about to within
 * a safety buffer). If so, callers treat the entry as a miss and fall
 * through to the network — which rewrites the cache with fresh URLs.
 *
 * Audio/video presigned URLs aren't a concern because retreatService
 * explicitly fetches those on-demand (see the comment above
 * getRetreatDetails) and never stores them in the entity cache.
 */

/**
 * If `url` is an AWS Sigv4 presigned URL, returns the Unix epoch (ms) at
 * which it expires. Returns `null` if the string isn't a presigned URL or
 * the expiry params can't be parsed.
 */
export function presignedUrlExpiry(url: string): number | null {
  if (typeof url !== 'string') return null;
  // Cheap pre-check to avoid building a URL object for every string.
  if (url.indexOf('X-Amz-Date=') === -1 || url.indexOf('X-Amz-Expires=') === -1) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const dateStr = parsed.searchParams.get('X-Amz-Date');
  const expiresStr = parsed.searchParams.get('X-Amz-Expires');
  if (!dateStr || !expiresStr) return null;
  // AWS Sigv4 format: YYYYMMDDTHHMMSSZ (basic ISO 8601, no separators).
  const m = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  const signedAt = Date.UTC(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), Number(m[6]),
  );
  const expiresSec = parseInt(expiresStr, 10);
  if (!Number.isFinite(expiresSec) || expiresSec <= 0) return null;
  return signedAt + expiresSec * 1000;
}

/**
 * `true` if the URL is presigned AND its expiry minus `bufferMs` is in the
 * past. Non-presigned URLs (CDN, public assets, http://example.com/...) are
 * not flagged — they're not subject to this kind of decay.
 *
 * The default 60-second buffer compensates for clock skew + the gap between
 * deciding to use a cache entry and actually issuing the GET against S3.
 */
export function isPresignedUrlExpired(url: string, bufferMs = 60_000, now = Date.now()): boolean {
  const expiry = presignedUrlExpiry(url);
  if (expiry == null) return false;
  return now > expiry - bufferMs;
}

/**
 * Recursively scans `data` for string values that look like expired
 * presigned URLs. Returns true on first hit — short-circuits to keep the
 * scan cheap even on large cached entities.
 *
 * Use this at cache read sites to decide whether a cached entry's
 * embedded URLs are still usable.
 */
export function hasExpiredPresignedUrl(data: unknown, bufferMs = 60_000, now = Date.now()): boolean {
  if (data == null) return false;
  if (typeof data === 'string') {
    return isPresignedUrlExpired(data, bufferMs, now);
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      if (hasExpiredPresignedUrl(item, bufferMs, now)) return true;
    }
    return false;
  }
  if (typeof data === 'object') {
    for (const value of Object.values(data as Record<string, unknown>)) {
      if (hasExpiredPresignedUrl(value, bufferMs, now)) return true;
    }
    return false;
  }
  return false;
}
