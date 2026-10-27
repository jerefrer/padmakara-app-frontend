import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import magicLinkService from '@/services/magicLinkService';

export type SignInPhase = 'email' | 'sending' | 'sent' | 'code' | 'done';
export type SignInError = 'invalid' | 'generic' | 'network' | 'badCode';

// The store-review account signs in with a code the reviewers are given (6 to 12 characters).
const CODE_MIN = 6;
const CODE_MAX = 12;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIRST_CHECK_MS = 2000;
const CHECK_EVERY_MS = 4000;
// About ten minutes of waiting, as the full-page check-email screen does.
const MAX_CHECKS = 150;
const RESEND_COOLDOWN_S = 60;

interface Options {
  /** The address is unknown: the person has to ask for access first. */
  onApprovalRequired?: (email: string) => void;
}

/**
 * The magic-link sign-in, without a screen: ask for the link, then poll until this device is
 * activated (the link may be opened on any device) and refresh the session. Shared by the
 * sign-in sheet and the inline sign-in card.
 */
export const REVIEW_CODE_MAX_LENGTH = CODE_MAX;

export function useMagicLinkSignIn({ onApprovalRequired }: Options = {}) {
  const { refreshAuth } = useAuth();
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<SignInPhase>('email');
  const [error, setError] = useState<SignInError | null>(null);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);
  const sentTo = useRef('');

  const submit = useCallback(async () => {
    const address = email.trim();
    if (!EMAIL.test(address)) {
      setError('invalid');
      return;
    }
    setError(null);
    setPhase('sending');
    try {
      const res = await magicLinkService.requestMagicLink(address, language);
      const status = res.success ? res.data?.status : undefined;
      if (status === 'magic_link_sent') {
        sentTo.current = address;
        setResent(false);
        setCooldown(RESEND_COOLDOWN_S);
        setPhase('sent');
      } else if (status === 'already_activated') {
        await refreshAuth();
        setPhase('done');
      } else if (status === 'code_required') {
        // Store-review account: no email is sent, the person types the review code instead.
        sentTo.current = address;
        setCode('');
        setPhase('code');
      } else if (status === 'approval_required') {
        setPhase('email');
        onApprovalRequired?.(address);
      } else {
        setPhase('email');
        setError('generic');
      }
    } catch {
      setPhase('email');
      setError('network');
    }
  }, [email, language, refreshAuth, onApprovalRequired]);

  const submitCode = useCallback(async () => {
    const value = code.trim();
    if (value.length < CODE_MIN || value.length > CODE_MAX) {
      setError('badCode');
      return;
    }
    setError(null);
    setPhase('sending');
    try {
      const res = await magicLinkService.reviewLogin(sentTo.current, value);
      if (res.success) {
        await refreshAuth();
        setPhase('done');
      } else {
        setPhase('code');
        setError(res.incorrectCode ? 'badCode' : 'generic');
      }
    } catch {
      setPhase('code');
      setError('network');
    }
  }, [code, refreshAuth]);

  // Wait for the link to be opened.
  useEffect(() => {
    if (phase !== 'sent') return;
    let cancelled = false;
    let checks = 0;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (cancelled) return;
      checks += 1;
      try {
        const res = await magicLinkService.checkActivationStatus();
        if (cancelled) return;
        if (res.success && res.data?.isActivated) {
          await refreshAuth();
          if (!cancelled) setPhase('done');
          return;
        }
      } catch {
        // A failed check is not an answer; keep waiting.
      }
      if (!cancelled && checks < MAX_CHECKS) timer = setTimeout(check, CHECK_EVERY_MS);
    };
    timer = setTimeout(check, FIRST_CHECK_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, refreshAuth]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = useCallback(async () => {
    if (cooldown > 0 || !sentTo.current) return;
    try {
      const res = await magicLinkService.requestMagicLink(sentTo.current, language);
      if (res.success) {
        setResent(true);
        setError(null);
        setCooldown(RESEND_COOLDOWN_S);
      } else {
        setError('generic');
      }
    } catch {
      setError('network');
    }
  }, [cooldown, language]);

  const reset = useCallback(() => {
    setPhase('email');
    setError(null);
    setResent(false);
    setCode('');
  }, []);

  return {
    email,
    setEmail,
    code,
    setCode,
    phase,
    error,
    cooldown,
    resent,
    sentTo: sentTo.current,
    submit,
    submitCode,
    resend,
    reset,
  };
}
