import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import PrivacyPolicyScreen from '@/app/privacy-policy';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), canGoBack: () => false, replace: jest.fn() },
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en', setLanguage: jest.fn() }),
}));

describe('privacy policy page', () => {
  it('should show the update date and the processors it relies on', () => {
    const { getByText } = render(<PrivacyPolicyScreen />);
    expect(getByText(/13 November 2026/)).toBeTruthy();
    for (const heading of [
      'File storage — Cloudflare R2',
      'Video hosting — Bunny Stream',
      'Email — Amazon SES',
      'Crash reporting — Sentry',
      'Payments on our website — Easypay',
    ]) {
      expect(getByText(heading)).toBeTruthy();
    }
  });

  it('should describe the server-side usage statistics and their retention', () => {
    const { getByText } = render(<PrivacyPolicyScreen />);
    expect(getByText('Usage Statistics')).toBeTruthy();
    expect(getByText(/our server counts, per day and per teaching/)).toBeTruthy();
    expect(getByText(/daily activity is deleted after 13 months/)).toBeTruthy();
  });

  it('should keep payments without contact details after deletion', () => {
    const { getByText } = render(<PrivacyPolicyScreen />);
    expect(getByText(/Records of past payments are kept, without your contact details/)).toBeTruthy();
  });

  it('should open the account deletion page from the link in Your Rights', () => {
    const { getByText } = render(<PrivacyPolicyScreen />);
    fireEvent.press(getByText('https://app.padmakara.pt/account-deletion'));
    expect(mockPush).toHaveBeenCalledWith('/account-deletion');
  });
});
