// Tiny module-level state shared by the sign-in code, the invitation gate and the invitation route.
// No imports on purpose: the sign-in hooks use it and must stay free of navigation dependencies.

// "An email sign-in just completed" marker. refreshAuth() flips isAuthenticated before the
// sign-in screen or sheet can react, and that screen then unmounts, so the screen cannot be the one
// to trigger the invitation. The sign-in code sets this marker BEFORE awaiting refreshAuth(); the
// persistent PasskeyInviteGate consumes it. A passkey sign-in never sets it (and clears it).
const MARKER_TTL_MS = 2 * 60 * 1000;
let emailSignInAt: number | null = null;

export function markEmailSignIn(): void {
  emailSignInAt = Date.now();
}

export function clearEmailSignInMarker(): void {
  emailSignInAt = null;
}

export function hasEmailSignInMarker(): boolean {
  return emailSignInAt !== null && Date.now() - emailSignInAt < MARKER_TTL_MS;
}

/** True once per marker; a stale marker (older than two minutes) counts as absent. */
export function consumeEmailSignIn(): boolean {
  const fresh = hasEmailSignInMarker();
  emailSignInAt = null;
  return fresh;
}

// The invitation route only shows when one of our triggers just opened it. The "already shown" flag
// cannot tell: the triggers set it before navigating. A reload, a browser Back or a typed URL finds
// the route unarmed and goes home instead of showing the invitation a second time.
const ARM_TTL_MS = 30 * 1000;
let armedAt: number | null = null;

export function armInvite(): void {
  armedAt = Date.now();
}

export function isInviteArmed(): boolean {
  return armedAt !== null && Date.now() - armedAt < ARM_TTL_MS;
}

export function disarmInvite(): void {
  armedAt = null;
}
