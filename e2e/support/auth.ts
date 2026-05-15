/**
 * Programmatic authentication helper for the Playwright e2e suite.
 *
 * The real app authenticates via a magic-link email round-trip, which cannot
 * be automated headlessly. Instead, these helpers talk to the backend's
 * test-only endpoints (mounted only when NODE_ENV !== "production"):
 *
 *   GET  /api/test/user-by-email — resolve a seeded user's DB id + role.
 *   POST /api/test/token         — mint a signed JWT for that user.
 *
 * The minted token, plus the `device_activated` flag and a `user_data`
 * object, are injected into `localStorage` via `page.addInitScript` BEFORE
 * the first navigation, so the app's AuthContext sees an authenticated,
 * device-activated session on its very first render — no magic-link flow.
 *
 * On web, AsyncStorage is backed by `window.localStorage` with no key
 * prefix, so the three keys map 1:1 to the keys the app reads:
 *   auth_token        — bearer JWT (tokenStorage reads this on web)
 *   device_activated  — "true" gates the activated state (magicLinkService)
 *   user_data         — JSON the app's authService parses into the User obj
 */

import type { Page } from '@playwright/test';

/** Backend base URL — overridable via env so config and helper stay in sync. */
const API_BASE =
  process.env.E2E_API_URL ?? 'http://localhost:3100/api';

/** A seeded test user as resolved from the backend. */
export interface SeededTestUser {
  id: number;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
}

/** Email addresses of the six seeded e2e users (see tests/e2e/support/fixtures.ts). */
export const TEST_USER_EMAILS = {
  nosub: 'e2e-nosub@example.com',
  subscriber: 'e2e-subscriber@example.com',
  groupMember: 'e2e-groupmember@example.com',
  participant: 'e2e-participant@example.com',
  granted: 'e2e-granted@example.com',
  admin: 'e2e-admin@example.com',
} as const;

export type TestUserKey = keyof typeof TEST_USER_EMAILS;

/** Resolve a seeded user's id + role from their email via the test endpoint. */
async function resolveUser(email: string): Promise<SeededTestUser> {
  const res = await fetch(
    `${API_BASE}/test/user-by-email?email=${encodeURIComponent(email)}`,
  );
  if (!res.ok) {
    throw new Error(
      `[e2e auth] /api/test/user-by-email failed for ${email}: ` +
        `${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as SeededTestUser;
}

/** Mint a JWT for a resolved user via the test-token endpoint. */
async function mintToken(user: SeededTestUser): Promise<string> {
  const res = await fetch(`${API_BASE}/test/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.id,
      email: user.email,
      role: user.role,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `[e2e auth] /api/test/token failed for ${user.email}: ` +
        `${res.status} ${await res.text()}`,
    );
  }
  const { token } = (await res.json()) as { token: string };
  if (!token) throw new Error('[e2e auth] /api/test/token returned no token');
  return token;
}

/**
 * Build the `user_data` JSON the app expects. The app's `authService`
 * JSON.parses this AsyncStorage value into the `User` interface; only a
 * subset of fields is actually read at startup, but we provide a complete,
 * well-formed object so nothing downstream throws on a missing field.
 */
function buildUserData(user: SeededTestUser): Record<string, unknown> {
  const isSubscriber =
    user.email === TEST_USER_EMAILS.subscriber ||
    user.email === TEST_USER_EMAILS.groupMember ||
    user.email === TEST_USER_EMAILS.participant;
  return {
    id: String(user.id),
    name: user.email.split('@')[0],
    email: user.email,
    avatar: null,
    retreat_groups: [],
    preferences: {
      language: 'en',
      contentLanguage: 'en',
      biometricEnabled: false,
      notifications: true,
    },
    subscription: {
      status: isSubscriber ? 'active' : 'none',
      source: null,
      expiresAt: isSubscriber ? '2027-01-01T00:00:00.000Z' : null,
    },
    created_at: '2024-01-01T00:00:00.000Z',
    last_login: new Date().toISOString(),
  };
}

/** Everything needed to inject an authenticated session. */
export interface AuthSession {
  user: SeededTestUser;
  token: string;
  userData: Record<string, unknown>;
}

/**
 * Resolve + mint a full auth session for a seeded user. Call this once per
 * test (in a `beforeEach` or at the top of the test) and pass the result to
 * `injectAuth`.
 */
export async function createAuthSession(
  userKey: TestUserKey,
): Promise<AuthSession> {
  const user = await resolveUser(TEST_USER_EMAILS[userKey]);
  const token = await mintToken(user);
  return { user, token, userData: buildUserData(user) };
}

/**
 * Inject an authenticated, device-activated session into the page's
 * `localStorage` before any app script runs. MUST be called before the
 * first `page.goto`.
 */
export async function injectAuth(
  page: Page,
  session: AuthSession,
): Promise<void> {
  await page.addInitScript(
    ({ token, userData }) => {
      try {
        window.localStorage.setItem('auth_token', token);
        window.localStorage.setItem('device_activated', 'true');
        window.localStorage.setItem('user_data', JSON.stringify(userData));
      } catch {
        // localStorage may be unavailable in some contexts — tests that
        // depend on auth will fail visibly downstream, which is correct.
      }
    },
    { token: session.token, userData: session.userData },
  );
}

/**
 * Convenience: resolve a session for `userKey` and inject it into `page`.
 * Returns the session so the test can also reference the user id / token.
 */
export async function authenticateAs(
  page: Page,
  userKey: TestUserKey,
): Promise<AuthSession> {
  const session = await createAuthSession(userKey);
  await injectAuth(page, session);
  return session;
}
