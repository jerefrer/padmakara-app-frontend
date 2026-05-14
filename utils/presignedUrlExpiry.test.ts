import {
  presignedUrlExpiry,
  isPresignedUrlExpired,
  hasExpiredPresignedUrl,
} from './presignedUrlExpiry';

// A real shape of S3 presigned URL as produced by AWS Sigv4, copy-pasted
// from a Padmakara hero. Signed at 2026-05-09T21:06:46Z, lifetime 3600s,
// so it expires at 2026-05-09T22:06:46Z.
const STALE_URL =
  'https://padmakara-pt-app.s3.eu-west-3.amazonaws.com/teachers/heroes/421-1778153720397.webp' +
  '?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
  '&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD' +
  '&X-Amz-Credential=AKIARW4A4LHEHBACEKX6%2F20260509%2Feu-west-3%2Fs3%2Faws4_request' +
  '&X-Amz-Date=20260509T210646Z' +
  '&X-Amz-Expires=3600' +
  '&X-Amz-Signature=5350bcd7115fcc8a653cf56c3a213154cdc03524f3e7cfe8eb70e6f04d30ea56' +
  '&X-Amz-SignedHeaders=host&x-id=GetObject';

const STALE_URL_EXPIRY_MS = Date.UTC(2026, 4, 9, 22, 6, 46); // 22:06:46Z

describe('presignedUrlExpiry()', () => {
  it('returns the correct expiry timestamp for a Sigv4 URL', () => {
    expect(presignedUrlExpiry(STALE_URL)).toBe(STALE_URL_EXPIRY_MS);
  });

  it('returns null for non-presigned http(s) URLs', () => {
    expect(presignedUrlExpiry('https://example.com/foo.webp')).toBeNull();
    expect(presignedUrlExpiry('http://localhost:8081/assets/logo.png')).toBeNull();
  });

  it('returns null for malformed presigned URLs (missing date or expires)', () => {
    expect(
      presignedUrlExpiry(
        'https://example.com/x?X-Amz-Date=20260509T210646Z',
      ),
    ).toBeNull();
    expect(
      presignedUrlExpiry(
        'https://example.com/x?X-Amz-Expires=3600',
      ),
    ).toBeNull();
  });

  it('returns null for an unparseable date string', () => {
    expect(
      presignedUrlExpiry(
        'https://example.com/x?X-Amz-Date=not-a-date&X-Amz-Expires=3600',
      ),
    ).toBeNull();
  });

  it('returns null for non-string input', () => {
    // @ts-expect-error — intentional misuse
    expect(presignedUrlExpiry(null)).toBeNull();
    // @ts-expect-error — intentional misuse
    expect(presignedUrlExpiry(undefined)).toBeNull();
    // @ts-expect-error — intentional misuse
    expect(presignedUrlExpiry(123)).toBeNull();
  });
});

describe('isPresignedUrlExpired()', () => {
  it('returns true when the URL is past its expiry (with default 60s buffer)', () => {
    // 1 ms past the expiry buffer
    const justAfter = STALE_URL_EXPIRY_MS - 60_000 + 1;
    expect(isPresignedUrlExpired(STALE_URL, 60_000, justAfter)).toBe(true);
  });

  it('returns false when the URL is still well within its lifetime', () => {
    // Right after signing, expiry is ~1h away → not expired.
    const justAfterSigning = Date.UTC(2026, 4, 9, 21, 7, 0);
    expect(isPresignedUrlExpired(STALE_URL, 60_000, justAfterSigning)).toBe(false);
  });

  it('returns false for non-presigned URLs regardless of the clock', () => {
    expect(isPresignedUrlExpired('https://example.com/foo.webp')).toBe(false);
  });
});

describe('hasExpiredPresignedUrl()', () => {
  // Pretend "now" is 5 days past the URL's expiry — the situation that
  // produced the gray-hero bug the user reported.
  const nowMs = STALE_URL_EXPIRY_MS + 5 * 24 * 3600 * 1000;

  it('returns true when an expired URL appears anywhere in nested data', () => {
    const event = {
      id: 560,
      title: 'Entering the Mahāyāna Path',
      eventTeachers: [
        {
          teacher: {
            id: 421,
            name: 'HHSGT',
            heroUrl: STALE_URL,
            avatarUrl: 'https://example.com/avatar.webp',
          },
        },
      ],
    };
    expect(hasExpiredPresignedUrl(event, 60_000, nowMs)).toBe(true);
  });

  it('returns false when all URLs are either non-presigned or still fresh', () => {
    const event = {
      id: 560,
      title: 'Title',
      eventTeachers: [{ teacher: { photoUrl: 'https://example.com/p.jpg' } }],
      // Fresh presigned URL: "now" is right after signing, before expiry.
      sessions: [],
    };
    // Use the fresh expiry case: pretend now is right after STALE_URL
    // was signed (within its 1-hour lifetime).
    const freshNow = Date.UTC(2026, 4, 9, 21, 7, 0);
    const eventWithFreshUrl = { ...event, hero: STALE_URL };
    expect(hasExpiredPresignedUrl(eventWithFreshUrl, 60_000, freshNow)).toBe(false);
  });

  it('returns false for null / undefined / primitive data', () => {
    expect(hasExpiredPresignedUrl(null, 60_000, nowMs)).toBe(false);
    expect(hasExpiredPresignedUrl(undefined, 60_000, nowMs)).toBe(false);
    expect(hasExpiredPresignedUrl(42, 60_000, nowMs)).toBe(false);
  });

  it('handles arrays of objects', () => {
    const items = [
      { id: 1, url: 'https://example.com/a.jpg' },
      { id: 2, url: STALE_URL },
    ];
    expect(hasExpiredPresignedUrl(items, 60_000, nowMs)).toBe(true);
  });
});
