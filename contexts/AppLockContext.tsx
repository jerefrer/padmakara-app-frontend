import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLockScreen } from '@/components/AppLockScreen';
import {
  APP_LOCK_GRACE_MS,
  authenticate,
  biometricKind,
  getAppLockEnabled,
  isNothingToAskFor,
  setAppLockEnabled,
  type BiometricKind,
} from '@/services/appLock';

interface AppLockContextType {
  /** The person turned the lock on for this device. */
  enabled: boolean;
  /** The lock screen is up. */
  locked: boolean;
  /** Which biometric this device offers; null when none is set up. */
  kind: BiometricKind | null;
  /** Asks for the biometric and, if it succeeds, lets the person in. */
  unlock: () => Promise<void>;
  /** Turns the lock on after a successful prompt. Resolves to whether it is now on. */
  enable: () => Promise<boolean>;
  /** Turns the lock off after a successful prompt. Resolves to whether it is now off. */
  disable: () => Promise<boolean>;
}

// Outside the provider (tests, screens mounted before it) the lock simply does not exist.
const AppLockContext = createContext<AppLockContextType>({
  enabled: false,
  locked: false,
  kind: null,
  unlock: async () => {},
  enable: async () => false,
  disable: async () => false,
});

export function useAppLock(): AppLockContextType {
  return useContext(AppLockContext);
}

/**
 * Locks the app behind the device's biometric (or passcode) when the person asked for it: at cold
 * start, and when the app returns to the foreground after at least APP_LOCK_GRACE_MS away.
 * Short `inactive` blips (the Face ID prompt itself, Control Centre) never count as being away.
 * The overlay sits above everything; audio keeps playing underneath.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { isAuthenticated, isLoading } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [kind, setKind] = useState<BiometricKind | null>(null);
  const [loaded, setLoaded] = useState(false);
  // The system prompt is open: the lock screen shows it is unlocking instead of the button.
  const [prompting, setPrompting] = useState(false);

  // The AppState listener and the prompt callbacks outlive renders, so they read the latest values here.
  const enabledRef = useRef(false);
  const authedRef = useRef(false);
  enabledRef.current = enabled;
  authedRef.current = isAuthenticated;
  const promptingRef = useRef(false);
  const startHandledRef = useRef(false);
  const wasAuthedRef = useRef(false);
  const backgroundedAtRef = useRef<number | null>(null);

  const label = useCallback(
    (key: string, fallback: string) => t(key) || fallback,
    [t],
  );

  const unlock = useCallback(async () => {
    if (promptingRef.current) return;
    promptingRef.current = true;
    setPrompting(true);
    try {
      const result = await authenticate({
        promptMessage: label('appLock.prompt', 'Unlock Padmakara'),
        cancelLabel: label('appLock.cancel', 'Cancel'),
      });
      if (result.success) {
        setLocked(false);
      } else if (isNothingToAskFor(result.error)) {
        // No biometric and no passcode left on the device: keeping the lock would shut the person out for good.
        await setAppLockEnabled(false).catch(() => undefined);
        setEnabled(false);
        setLocked(false);
      }
    } finally {
      promptingRef.current = false;
      setPrompting(false);
    }
  }, [label]);

  const lock = useCallback(() => {
    setLocked(true);
    void unlock();
  }, [unlock]);

  const enable = useCallback(async () => {
    const result = await authenticate({
      promptMessage: label('appLock.enablePrompt', 'Turn on the app lock'),
      cancelLabel: label('appLock.cancel', 'Cancel'),
    });
    if (!result.success) return false;
    try {
      await setAppLockEnabled(true);
    } catch {
      return false;
    }
    setEnabled(true);
    return true;
  }, [label]);

  const disable = useCallback(async () => {
    const result = await authenticate({
      promptMessage: label('appLock.disablePrompt', 'Turn off the app lock'),
      cancelLabel: label('appLock.cancel', 'Cancel'),
    });
    // With nothing left to ask for, turning it off must still work.
    if (!result.success && !isNothingToAskFor(result.error)) return false;
    try {
      await setAppLockEnabled(false);
    } catch {
      return false;
    }
    setEnabled(false);
    return true;
  }, [label]);

  // Load the flag and the biometric kind once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [flag, available] = await Promise.all([getAppLockEnabled(), biometricKind()]);
      if (cancelled) return;
      setEnabled(flag);
      setKind(available);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cold start: decide once, as soon as both the flag and the sign-in state are known.
  useEffect(() => {
    if (!loaded || isLoading || startHandledRef.current) return;
    startHandledRef.current = true;
    if (enabled && isAuthenticated) lock();
  }, [loaded, isLoading, enabled, isAuthenticated, lock]);

  // Signing out or forgetting the device ends the lock: it belongs to the signed-in person.
  useEffect(() => {
    if (wasAuthedRef.current && !isAuthenticated) {
      setLocked(false);
      setEnabled(false);
      setAppLockEnabled(false).catch(() => undefined);
    }
    wasAuthedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background') {
        backgroundedAtRef.current = Date.now();
      } else if (next === 'active') {
        const since = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        // The person may have set up (or removed) Face ID in the device settings meanwhile.
        biometricKind().then(setKind);
        if (since !== null && Date.now() - since >= APP_LOCK_GRACE_MS && enabledRef.current && authedRef.current) {
          lock();
        }
      }
    });
    return () => sub.remove();
  }, [lock]);

  // While the sign-in state is still loading at cold start, an enabled lock keeps the app covered:
  // otherwise the content would flash for a moment before the lock screen. (Reading the flag itself
  // takes a few milliseconds; covering during that read would cover every app, locked or not.)
  const pending = !startHandledRef.current && loaded && enabled && isLoading;

  return (
    <AppLockContext.Provider value={{ enabled, locked, kind, unlock, enable, disable }}>
      {children}
      {locked || (pending && Platform.OS !== 'web') ? (
        <AppLockScreen kind={kind} onUnlock={unlock} pending={!locked} prompting={prompting} />
      ) : null}
    </AppLockContext.Provider>
  );
}
