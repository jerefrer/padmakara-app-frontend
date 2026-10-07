import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import PublicationsScreen from '@/app/(tabs)/(groups)/publications';
import { publicationService } from '@/services/publicationService';
import en from '@/locales/en.json';
import pt from '@/locales/pt.json';

const mockPush = jest.fn();
let mockAuth: { isAuthenticated: boolean; hasActiveSubscription: boolean };
let mockLocale: any = en;

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: (...a: any[]) => mockPush(...a), back: jest.fn() },
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key.split('.').reduce((node: any, part) => node?.[part], mockLocale),
    language: 'en',
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ isDesktop: false }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/components/PDFViewer', () => ({ PDFViewer: () => null }));
jest.mock('@/services/publicationService', () => ({
  publicationService: {
    getPublicationsSync: jest.fn(() => null),
    getPublications: jest.fn(),
  },
}));

const WEB_COPY_EN = 'Become a member to access the full library';
const WEB_COPY_PT = 'Torne-se membro para aceder a toda a biblioteca';
const NATIVE_COPY_EN = 'Activate your account to access the full library';

const original = Platform.OS;
const publicationsHidden = () =>
  (publicationService.getPublications as jest.Mock).mockResolvedValue({ publications: [], hasHiddenPublications: true });

beforeEach(() => {
  jest.clearAllMocks();
  mockLocale = en;
  mockAuth = { isAuthenticated: false, hasActiveSubscription: false };
  publicationsHidden();
});
afterAll(() => {
  (Platform as any).OS = original;
});

describe('publications members banner', () => {
  it('should invite web visitors to become a member and open /membership', async () => {
    (Platform as any).OS = 'web';
    const { findByText, queryByText } = render(<PublicationsScreen />);
    fireEvent.press(await findByText(WEB_COPY_EN));
    expect(mockPush).toHaveBeenCalledWith('/membership');
    expect(queryByText(NATIVE_COPY_EN)).toBeNull();
  });

  it('should word the web banner in Portuguese too', async () => {
    (Platform as any).OS = 'web';
    mockLocale = pt;
    const { findByText } = render(<PublicationsScreen />);
    expect(await findByText(WEB_COPY_PT)).toBeTruthy();
  });

  it('should show a signed-in non-member on the web the same member invitation', async () => {
    (Platform as any).OS = 'web';
    mockAuth = { isAuthenticated: true, hasActiveSubscription: false };
    const { findByText } = render(<PublicationsScreen />);
    fireEvent.press(await findByText(WEB_COPY_EN));
    expect(mockPush).toHaveBeenCalledWith('/membership');
  });

  it('should keep the sign-in copy and behaviour for a signed-out native visitor, without the web copy', async () => {
    (Platform as any).OS = 'ios';
    const { findByText, queryByText } = render(<PublicationsScreen />);
    fireEvent.press(await findByText(NATIVE_COPY_EN));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/magic-link');
    expect(queryByText(WEB_COPY_EN)).toBeNull();
  });

  it('should show a signed-in native non-member no banner at all', async () => {
    (Platform as any).OS = 'ios';
    mockAuth = { isAuthenticated: true, hasActiveSubscription: false };
    const { queryByText } = render(<PublicationsScreen />);
    await waitFor(() => expect(publicationService.getPublications).toHaveBeenCalled());
    expect(queryByText(WEB_COPY_EN)).toBeNull();
    expect(queryByText(NATIVE_COPY_EN)).toBeNull();
  });

  it('should show members no banner', async () => {
    (Platform as any).OS = 'web';
    mockAuth = { isAuthenticated: true, hasActiveSubscription: true };
    const { queryByText } = render(<PublicationsScreen />);
    await waitFor(() => expect(publicationService.getPublications).toHaveBeenCalled());
    expect(queryByText(WEB_COPY_EN)).toBeNull();
  });
});
