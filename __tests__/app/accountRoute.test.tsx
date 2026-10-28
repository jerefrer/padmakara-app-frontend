import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { Platform } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import AccountRoute from '@/app/(tabs)/account';
import MembershipScreen from '@/app/(tabs)/membership/index';
import { membershipService } from '@/services/membershipService';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { name: 'Ana', email: 'ana@example.com' } }),
}));
jest.mock('@/services/membershipService', () => ({
  membershipService: { get: jest.fn(), join: jest.fn() },
}));

const originalOS = Platform.OS;
beforeEach(() => {
  (Platform as any).OS = 'web';
  (membershipService.get as jest.Mock).mockResolvedValue({
    success: true,
    data: {
      state: 'none', source: null, amount: null, interval: null, accessUntil: null, graceUntil: null,
      cancelledAt: null, method: null, history: [], lastPaymentFailedAt: null,
    },
  });
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

describe('/account route', () => {
  it('should render the membership screen directly, without redirecting', async () => {
    expect(AccountRoute).toBe(MembershipScreen);
    const { getByText } = render(<AccountRoute />);
    await waitFor(() => expect(getByText('Become a Member')).toBeTruthy());
  });

  it('should be hidden from the tab bar like membership', () => {
    const layout = fs.readFileSync(path.resolve(__dirname, '../../app/(tabs)/_layout.tsx'), 'utf8');
    expect(layout).toMatch(/name="account"\s+options=\{\{\s*href: null,/);
  });
});
