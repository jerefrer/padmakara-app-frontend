import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { AppLockProvider } from '@/contexts/AppLockContext';
import * as appLock from '@/services/appLock';

// The cover is an iOS modal: closing it and opening a new one in the next render makes UIKit
// refuse the second presentation ("while a presentation is in progress"), and the app shows
// unlocked behind the Face ID prompt. So the cover must stay mounted from the start to the lock.
const coverEvents: string[] = [];
jest.mock('@/components/AppLockScreen', () => ({
  AppLockScreen: () => {
    const { useEffect: useMountEffect } = jest.requireActual('react');
    useMountEffect(() => {
      coverEvents.push('mount');
      return () => coverEvents.push('unmount');
    }, []);
    return null;
  },
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/services/appLock', () => ({
  ...jest.requireActual('@/services/appLock'),
  getAppLockEnabled: jest.fn(async () => true),
  setAppLockEnabled: jest.fn(async () => undefined),
  biometricKind: jest.fn(async () => 'faceId'),
  // The Face ID prompt stays open: the person has not looked at the phone.
  authenticate: jest.fn(() => new Promise(() => undefined)),
  appLockEnabledAtStart: jest.fn(() => true),
}));

const svc = appLock as jest.Mocked<typeof appLock>;

describe('AppLockProvider cover at cold start', () => {
  it('should keep the cover mounted from the splash until the lock, without closing it in between', async () => {
    // Jérémy: with Face ID on, the home showed behind the Face ID prompt instead of the cover.
    coverEvents.length = 0;

    render(
      <AppLockProvider>
        <Text>content</Text>
      </AppLockProvider>,
    );
    await act(async () => {});

    expect(svc.authenticate).toHaveBeenCalledTimes(1);
    expect(coverEvents).toEqual(['mount']);
  });
});

