import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PublicationsScreen from '@/app/(tabs)/(groups)/publications';
import { publicationService } from '@/services/publicationService';

let mockPdfProps: any;
let mockParams: Record<string, string> = {};
const mockGoToPage = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => {},
  router: { push: jest.fn(), back: jest.fn(), setParams: jest.fn() },
}));
// Signed out: the reader state lives on this device only.
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, hasActiveSubscription: false, user: null }),
}));
jest.mock('@/components/auth/SignInProvider', () => ({ useSignIn: () => ({ openSignIn: jest.fn() }) }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ isDesktop: false }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/components/PDFViewer', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    PDFViewer: React.forwardRef((props: any, ref: any) => {
      mockPdfProps = props;
      React.useImperativeHandle(ref, () => ({ goToPage: mockGoToPage }));
      return <View testID="pdf-viewer" />;
    }),
  };
});
jest.mock('@/services/publicationService', () => ({
  publicationService: {
    getPublicationsSync: jest.fn(() => null),
    getPublications: jest.fn(),
    getCachedPdf: jest.fn(),
    getCachedFile: jest.fn(),
    downloadAndCachePdf: jest.fn(),
    getDeviceOpenTimes: jest.fn(() => Promise.resolve({})),
    recordOpen: jest.fn(() => Promise.resolve()),
  },
}));

const original = Platform.OS;

beforeEach(() => {
  mockPdfProps = undefined;
  mockParams = { open: '5' };
  mockGoToPage.mockClear();
  (Platform as any).OS = 'ios';
  (publicationService.getPublications as jest.Mock).mockResolvedValue({
    publications: [
      {
        id: '5',
        title: 'O Tesouro de Bênçãos',
        authors: [],
        language: 'pt',
        version: null,
        pageCount: 40,
        updatedAt: '2025-01-01',
      },
    ],
    hasHiddenPublications: false,
  });
  (publicationService.getCachedPdf as jest.Mock).mockResolvedValue('file:///cache/5.pdf');
  (publicationService.getCachedFile as jest.Mock).mockResolvedValue({ version: null, fingerprint: null, updatedAt: '2025-01-01' });
});
afterAll(() => {
  (Platform as any).OS = original;
});

describe('publication reader — resume', () => {
  it('should reopen the publication on the page the reader left', async () => {
    await AsyncStorage.setItem('@reader:position:publication:5', JSON.stringify({ page: 12, at: 1000 }));

    render(<PublicationsScreen />);
    await screen.findByTestId('pdf-viewer');

    expect(mockPdfProps.initialPage).toBe(12);
  });

  it('should open on the page a link asks for rather than the one left', async () => {
    await AsyncStorage.setItem('@reader:position:publication:5', JSON.stringify({ page: 12, at: 1000 }));
    mockParams = { open: '5', page: '30' };

    render(<PublicationsScreen />);
    await screen.findByTestId('pdf-viewer');

    expect(mockPdfProps.initialPage).toBe(30);
  });

  it('should open a publication never read on its first page', async () => {
    render(<PublicationsScreen />);
    await screen.findByTestId('pdf-viewer');

    expect(mockPdfProps.initialPage ?? 1).toBe(1);
  });
});

describe('publication reader — page bookmarks', () => {
  it('should bookmark the page on screen and list it next to the contents', async () => {
    render(<PublicationsScreen />);
    await screen.findByTestId('pdf-viewer');
    act(() => mockPdfProps.onPageChange(12, 40));
    // No contents and no bookmark yet: nothing to list.
    expect(screen.queryByTestId('publication-contents-button')).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Bookmark this page')));

    expect(screen.getByTestId('publication-page-bookmark-button').props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(screen.getByTestId('publication-contents-button'));
    expect(screen.getByText('Page 12')).toBeTruthy();
  });

  it('should jump to a bookmarked page from the list', async () => {
    render(<PublicationsScreen />);
    await screen.findByTestId('pdf-viewer');
    act(() => mockPdfProps.onPageChange(3, 40));
    await act(async () => fireEvent.press(screen.getByLabelText('Bookmark this page')));
    act(() => mockPdfProps.onPageChange(20, 40));

    fireEvent.press(screen.getByTestId('publication-contents-button'));
    fireEvent.press(screen.getByText('Page 3'));

    expect(mockGoToPage).toHaveBeenCalledWith(3);
  });

  it('should show the page bookmark filled only on a bookmarked page, and remove it', async () => {
    render(<PublicationsScreen />);
    await screen.findByTestId('pdf-viewer');
    act(() => mockPdfProps.onPageChange(3, 40));
    await act(async () => fireEvent.press(screen.getByLabelText('Bookmark this page')));

    act(() => mockPdfProps.onPageChange(4, 40));
    expect(screen.getByLabelText('Bookmark this page')).toBeTruthy();

    act(() => mockPdfProps.onPageChange(3, 40));
    await act(async () => fireEvent.press(screen.getByLabelText('Remove the bookmark on this page')));

    expect(screen.getByLabelText('Bookmark this page')).toBeTruthy();
    expect(screen.queryByTestId('publication-contents-button')).toBeNull();
  });
});
