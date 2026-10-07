import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import ClosedScreen from '@/app/membership/closed';

const mockReplace = jest.fn();
const mockRedirect = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  router: { replace: (...a: any[]) => mockReplace(...a) },
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as any).OS = 'web';
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

describe('membership closed screen', () => {
  it('should say no payment was made', () => {
    const { getByText } = render(<ClosedScreen />);
    expect(getByText('No payment was made')).toBeTruthy();
    expect(getByText('You can come back whenever you like.')).toBeTruthy();
  });

  it('should send the member back to the membership page when they try again', () => {
    const { getByText } = render(<ClosedScreen />);
    fireEvent.press(getByText('Try again'));
    expect(mockReplace).toHaveBeenCalledWith('/membership');
  });

  it('should send the member to the tabs when they choose not now', () => {
    const { getByText } = render(<ClosedScreen />);
    fireEvent.press(getByText('Not now'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('should redirect to the tabs and show nothing on native', () => {
    (Platform as any).OS = 'ios';
    const { queryByText } = render(<ClosedScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
    expect(queryByText('No payment was made')).toBeNull();
  });
});
