import React from 'react';
import { Platform } from 'react-native';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { LockedRetreat } from '@/components/membership/LockedRetreat';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text testID={`icon-${props.name}`}>{props.name}</Text> };
});

const mockPush = jest.fn();
let mockAuth: any;

jest.mock('expo-router', () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));

const PREVIEW = {
  id: 7,
  titleEn: 'Spring retreat',
  titlePt: null,
  startDate: '2026-04-12',
  endDate: '2026-04-13',
  imageUrl: null,
  teachers: [{ name: 'Teacher One' }],
  sessionCount: 4,
  audience: 'free-subscribers' as const,
};

const original = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { isAuthenticated: false };
});
afterAll(() => {
  (Platform as any).OS = original;
});

describe('LockedRetreat on web', () => {
  beforeEach(() => {
    (Platform as any).OS = 'web';
  });

  it('should show the title, the teacher and a Become a member button leading to /membership', () => {
    const { getByText } = render(<LockedRetreat reason="membership" preview={PREVIEW} />);
    expect(getByText('Spring retreat')).toBeTruthy();
    expect(getByText('Teacher One')).toBeTruthy();
    expect(getByText('Recordings for members')).toBeTruthy();
    fireEvent.press(getByText('Become a member · from €5/month'));
    expect(mockPush).toHaveBeenCalledWith('/membership');
  });

  it('should present the lock as plain text under a thin rule with a lock icon, not a tinted box', () => {
    const { getByTestId } = render(<LockedRetreat reason="membership" preview={PREVIEW} />);
    const style = StyleSheet.flatten(getByTestId('locked-retreat-block').props.style) ?? {};
    expect(style.borderTopWidth).toBe(1);
    expect(style.borderRadius).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();
    expect(getByTestId('icon-lock-closed-outline')).toBeTruthy();
  });

  it('should offer Already a member? Sign in only when signed out', () => {
    const out = render(<LockedRetreat reason="auth" preview={PREVIEW} />);
    expect(out.getByText('Already a member? Sign in')).toBeTruthy();
    out.unmount();
    mockAuth = { isAuthenticated: true };
    const inn = render(<LockedRetreat reason="membership" preview={PREVIEW} />);
    expect(inn.queryByText('Already a member? Sign in')).toBeNull();
  });
});

describe('LockedRetreat on native', () => {
  beforeEach(() => {
    (Platform as any).OS = 'ios';
  });

  it('should show no price, no Become button and no website link', () => {
    const { getByText, queryByText, toJSON } = render(<LockedRetreat reason="membership" preview={PREVIEW} />);
    expect(getByText('Available to members')).toBeTruthy();
    expect(getByText('Once your account has access, these recordings appear here automatically.')).toBeTruthy();
    expect(queryByText(/Become/)).toBeNull();
    const dump = JSON.stringify(toJSON());
    expect(dump).not.toContain('€');
    expect(dump).not.toContain('padmakara.pt');
  });

  it('should offer Sign in only when signed out', () => {
    const out = render(<LockedRetreat reason="auth" preview={PREVIEW} />);
    fireEvent.press(out.getByText('Sign in'));
    expect(mockPush).toHaveBeenCalled();
    out.unmount();
    mockAuth = { isAuthenticated: true };
    const inn = render(<LockedRetreat reason="membership" preview={PREVIEW} />);
    expect(inn.queryByText('Sign in')).toBeNull();
  });
});

describe('LockedRetreat sign-in return route', () => {
  const expected = {
    pathname: '/(auth)/magic-link',
    params: { returnTo: '/(tabs)/(groups)/retreat/7' },
  };

  it('should send the web sign-in link back to this retreat', () => {
    (Platform as any).OS = 'web';
    const { getByText } = render(<LockedRetreat reason="auth" preview={PREVIEW} />);
    fireEvent.press(getByText('Already a member? Sign in'));
    expect(mockPush).toHaveBeenCalledWith(expected);
  });

  it('should send the native Sign in button back to this retreat', () => {
    (Platform as any).OS = 'ios';
    const { getByText } = render(<LockedRetreat reason="auth" preview={PREVIEW} />);
    fireEvent.press(getByText('Sign in'));
    expect(mockPush).toHaveBeenCalledWith(expected);
  });
});

describe('LockedRetreat reason other', () => {
  it.each(['web', 'ios'])('should say it is for participants and show no button on %s', (os) => {
    (Platform as any).OS = os;
    const { getByText, queryAllByRole } = render(<LockedRetreat reason="other" preview={null} />);
    expect(getByText('This retreat is available to its participants.')).toBeTruthy();
    expect(queryAllByRole('button')).toHaveLength(0);
  });
});
