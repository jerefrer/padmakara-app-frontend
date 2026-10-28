import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import magicLinkService from '@/services/magicLinkService';
import { markEmailSignIn } from '@/hooks/passkeyInviteState';

export const EMAIL_CODE_LENGTH = 6;

export type EmailCodeError = 'badCode' | 'network' | 'generic';

/** Keeps digits only, so "123 456" pasted from the email becomes "123456". */
export const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH);

/**
 * Sign in with the 6-digit code from the sign-in email. Independent of the link polling (which
 * keeps running while the person types) and of the store-review code flow.
 */
export function useEmailCodeSignIn(getEmail: () => string, onSignedIn?: () => void) {
  const { refreshAuth } = useAuth();
  const [emailCode, setEmailCodeState] = useState('');
  const [emailCodeError, setEmailCodeError] = useState<EmailCodeError | null>(null);
  const [emailCodeBusy, setEmailCodeBusy] = useState(false);

  const setEmailCode = useCallback((value: string) => setEmailCodeState(digitsOnly(value)), []);

  const submitEmailCode = useCallback(
    async (value?: string) => {
      const digits = digitsOnly(value ?? emailCode);
      if (digits.length !== EMAIL_CODE_LENGTH) {
        setEmailCodeError('badCode');
        return;
      }
      setEmailCodeError(null);
      setEmailCodeBusy(true);
      try {
        const res = await magicLinkService.verifyEmailCode(getEmail(), digits);
        if (res.success) {
          markEmailSignIn();
          await refreshAuth();
          onSignedIn?.();
        } else {
          setEmailCodeError(res.incorrectCode ? 'badCode' : res.network ? 'network' : 'generic');
        }
      } catch {
        setEmailCodeError('network');
      } finally {
        setEmailCodeBusy(false);
      }
    },
    [emailCode, getEmail, refreshAuth, onSignedIn],
  );

  const resetEmailCode = useCallback(() => {
    setEmailCodeState('');
    setEmailCodeError(null);
  }, []);

  return { emailCode, setEmailCode, emailCodeError, emailCodeBusy, submitEmailCode, resetEmailCode };
}
