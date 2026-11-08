import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';

import PublicationsScreen from '@/app/(tabs)/(groups)/publications';
import { publicationService } from '@/services/publicationService';

const mockBack = jest.fn();
const mockSetParams = jest.fn();
let mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
  router: { push: jest.fn(), back: (...a: any[]) => mockBack(...a), setParams: (...a: any[]) => mockSetParams(...a) },
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, hasActiveSubscription: true }),
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ isDesktop: false }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/components/PDFViewer', () => {
  const { Text } = require('react-native');
  return { PDFViewer: ({ source }: { source: string }) => <Text testID="pdf-viewer">{source}</Text> };
});
jest.mock('@/services/publicationService', () => ({
  publicationService: {
    getPublicationsSync: jest.fn(() => null),
    getPublications: jest.fn(),
    getCachedPdf: jest.fn(),
    getCachedVersion: jest.fn(),
    downloadAndCachePdf: jest.fn(),
    getReadingPosition: jest.fn(() => Promise.resolve(null)),
    saveReadingPosition: jest.fn(),
  },
}));

const pubs = [
  { id: '5', title: 'The Excellent Path', authors: [], language: 'en', version: null, updatedAt: '2025-01-01' },
  { id: '6', title: 'Other Book', authors: [], language: 'en', version: null, updatedAt: '2025-01-01' },
];
const original = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  (Platform as any).OS = 'ios';
  (publicationService.getPublications as jest.Mock).mockResolvedValue({
    publications: pubs,
    hasHiddenPublications: false,
  });
  (publicationService.getCachedPdf as jest.Mock).mockResolvedValue('file:///cache/5.pdf');
  (publicationService.getCachedVersion as jest.Mock).mockResolvedValue(null);
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
});
afterAll(() => {
  (Platform as any).OS = original;
});

describe('publications screen open param', () => {
  it("should open the publication's PDF when the screen receives an open param", async () => {
    mockParams = { open: '5' };
    const screen = render(<PublicationsScreen />);
    expect((await screen.findByTestId('pdf-viewer')).props.children).toBe('file:///cache/5.pdf');
    expect(publicationService.getCachedPdf).toHaveBeenCalledWith('5');
    expect(mockSetParams).toHaveBeenCalledWith({ open: undefined });
  });

  it('should show the list when the open param matches no publication', async () => {
    mockParams = { open: '999' };
    const screen = render(<PublicationsScreen />);
    expect(await screen.findByText('The Excellent Path')).toBeTruthy();
    expect(screen.queryByTestId('pdf-viewer')).toBeNull();
  });

  it('should go back to the event page when the viewer opened from the param is closed', async () => {
    mockParams = { open: '5' };
    const screen = render(<PublicationsScreen />);
    await screen.findByTestId('pdf-viewer');
    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('publication viewer share button', () => {
  it('should show a share button in the native viewer and share the cached file', async () => {
    mockParams = { open: '5' };
    const screen = render(<PublicationsScreen />);
    fireEvent.press(await screen.findByTestId('publication-share-button'));
    await waitFor(() =>
      expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/5.pdf', {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      }),
    );
  });

  it('should not show the share button on the web', async () => {
    (Platform as any).OS = 'web';
    mockParams = { open: '5' };
    const screen = render(<PublicationsScreen />);
    await screen.findByTestId('pdf-viewer');
    expect(screen.queryByTestId('publication-share-button')).toBeNull();
  });
});
