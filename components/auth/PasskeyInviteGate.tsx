import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { consumeEmailSignIn, hasEmailSignInMarker } from '@/hooks/passkeyInviteState';
import { inviteAfterEmailSignIn } from '@/hooks/usePasskeyInvite';

// Long enough for the sign-in sheet to finish dismissing (native modal), for check-email's own
// redirect (1 s) and for the magic-link redirect to land, so the invitation opens over the
// destination instead of being replaced by it.
export const INVITE_SETTLE_MS = 1500;

/**
 * Trigger 1 of the passkey invitation: right after an email sign-in (link or code). It lives for
 * the whole app lifetime because the screens that complete a sign-in unmount as soon as
 * refreshAuth() flips isAuthenticated. Sign-in code sets the marker before awaiting refreshAuth;
 * this gate consumes it once the session and user are known. A passkey sign-in never sets it.
 */
export function PasskeyInviteGate() {
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id ? String(user.id) : '';

  useEffect(() => {
    if (!isAuthenticated || !userId || !hasEmailSignInMarker()) return;
    const timer = setTimeout(() => {
      if (!consumeEmailSignIn()) return;
      inviteAfterEmailSignIn(userId).catch(() => {});
    }, INVITE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isAuthenticated, userId]);

  return null;
}
