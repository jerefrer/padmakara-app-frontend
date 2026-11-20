import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, screen, act, waitFor } from '@testing-library/react-native';

import PublicationsScreen from '@/app/(tabs)/(groups)/publications';
import { publicationService } from '@/services/publicationService';

// Every focus callback the screen registers, so a test can bring it back into focus.
const mockFocusCallbacks: (() => void)[] = [];

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    Stack: { Screen: () => null },
    useLocalSearchParams: () => ({}),
    router: { push: jest.fn(), back: jest.fn(), setParams: jest.fn() },
    useFocusEffect: (callback: () => void) => {
      useEffect(() => {
        mockFocusCallbacks.push(callback);
        return callback();
      }, [callback]);
    },
  };
});
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, hasActiveSubscription: true }),
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const locale = require('@/locales/en.json');
      return key.split('.').reduce((node: any, part) => node?.[part], locale);
    },
    language: 'en',
  }),
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
    getDeviceOpenTimes: jest.fn(),
    recordOpen: jest.fn(() => Promise.resolve()),
    getCachedPdf: jest.fn(() => Promise.resolve('file:///cache/x.pdf')),
    getCachedFile: jest.fn(() => Promise.resolve(null)),
    getReadingPosition: jest.fn(() => Promise.resolve(null)),
    saveReadingPosition: jest.fn(),
  },
}));

const pub = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  authors: [],
  language: 'pt',
  version: null,
  publicationDate: null,
  updatedAt: '2025-01-01T00:00:00.000Z',
  lastOpenedAt: null,
  ...extra,
});

const TITLES = /^(Newest|Oldest|Opened here|Opened elsewhere)$/;

async function shownTitles(): Promise<string[]> {
  return (await screen.findAllByText(TITLES)).map((node) => node.props.children);
}

beforeEach(() => {
  mockFocusCallbacks.length = 0;
  (Platform as any).OS = 'ios';
  (publicationService.getPublications as jest.Mock).mockResolvedValue({
    publications: [
      pub('1', 'Oldest', { publicationDate: '2020-01-01' }),
      pub('2', 'Newest', { publicationDate: '2025-06-01' }),
      pub('3', 'Opened elsewhere', { publicationDate: '2019-01-01', lastOpenedAt: '2026-11-01T00:00:00.000Z' }),
      pub('4', 'Opened here', { publicationDate: '2018-01-01' }),
    ],
    hasHiddenPublications: false,
  });
  (publicationService.getDeviceOpenTimes as jest.Mock).mockResolvedValue({
    '4': Date.parse('2026-11-10T00:00:00.000Z'),
  });
});

describe('publications "Last opened" tab', () => {
  it('should be the first tab, selected by default', async () => {
    render(<PublicationsScreen />);

    const tab = await screen.findByTestId('publications-tab-lastOpened');

    expect(screen.getByText('recent')).toBeTruthy();
    expect(tab.props.accessibilityState).toEqual({ selected: true });
  });

  it('should list opened publications first by recency across devices, then the others newest first', async () => {
    render(<PublicationsScreen />);

    await waitFor(async () =>
      expect(await shownTitles()).toEqual(['Opened here', 'Opened elsewhere', 'Newest', 'Oldest']),
    );
  });

  it('should record the open and bring the publication to the top', async () => {
    render(<PublicationsScreen />);
    await waitFor(async () => expect((await shownTitles())[0]).toBe('Opened here'));

    fireEvent.press(screen.getByText('Oldest'));
    await screen.findByTestId('pdf-viewer');

    expect(publicationService.recordOpen).toHaveBeenCalledWith('1', { signedIn: true });

    fireEvent.press(screen.getByLabelText(/back/i));
    await waitFor(async () => expect((await shownTitles())[0]).toBe('Oldest'));
  });

  it('should take up opens from other devices when the screen comes back into focus', async () => {
    render(<PublicationsScreen />);
    await waitFor(async () => expect((await shownTitles())[0]).toBe('Opened here'));
    (publicationService.getPublications as jest.Mock).mockResolvedValueOnce({
      publications: [
        pub('1', 'Oldest', { publicationDate: '2020-01-01', lastOpenedAt: '2026-11-17T00:00:00.000Z' }),
        pub('2', 'Newest', { publicationDate: '2025-06-01' }),
      ],
      hasHiddenPublications: false,
    });

    await act(async () => {
      for (const callback of [...mockFocusCallbacks]) callback();
    });

    expect(publicationService.getPublications).toHaveBeenLastCalledWith(undefined, undefined, { force: true });
    await waitFor(async () => expect((await shownTitles())[0]).toBe('Oldest'));
  });
});
