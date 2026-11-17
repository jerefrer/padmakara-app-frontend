import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PublicationsScreen from '@/app/(tabs)/(groups)/publications';
import { publicationService } from '@/services/publicationService';

let mockPdfProps: any;
let mockPdfMounts = 0;
// Every contentInsetTop the reader received: each change reached the native view.
let mockInsets: number[] = [];

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ open: '5' }),
  router: { push: jest.fn(), back: jest.fn(), setParams: jest.fn() },
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, hasActiveSubscription: true }),
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ isDesktop: false }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
// The native reader stands in for react-native-pdf: it records its props and
// how often it was mounted (a remount would reopen the document at page 1).
jest.mock('@/components/PDFViewer', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    PDFViewer: (props: any) => {
      mockPdfProps = props;
      if (mockInsets[mockInsets.length - 1] !== props.contentInsetTop) mockInsets.push(props.contentInsetTop);
      React.useEffect(() => {
        mockPdfMounts += 1;
      }, []);
      return <View testID="pdf-viewer" />;
    },
  };
});
jest.mock('@/services/publicationService', () => ({
  publicationService: {
    getPublicationsSync: jest.fn(() => null),
    getPublications: jest.fn(),
    getCachedPdf: jest.fn(),
    getCachedFile: jest.fn(),
    downloadAndCachePdf: jest.fn(),
    getReadingPosition: jest.fn(() => Promise.resolve(null)),
    saveReadingPosition: jest.fn(),
  },
}));

const original = Platform.OS;

beforeEach(() => {
  mockPdfProps = undefined;
  mockPdfMounts = 0;
  mockInsets = [];
  (Platform as any).OS = 'ios';
  (publicationService.getPublications as jest.Mock).mockResolvedValue({
    publications: [{ id: '5', title: 'Os Cinco Agregados', authors: [], language: 'pt', version: null, updatedAt: '2025-01-01' }],
    hasHiddenPublications: false,
  });
  (publicationService.getCachedPdf as jest.Mock).mockResolvedValue('file:///cache/5.pdf');
  (publicationService.getCachedFile as jest.Mock).mockResolvedValue({ version: null, fingerprint: null, updatedAt: '2025-01-01' });
});
afterAll(() => {
  (Platform as any).OS = original;
});

const layoutBar = (height: number) =>
  fireEvent(screen.getByTestId('reader-top-bar', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 800, height } },
  });

async function openReaderOnPage(page: number) {
  render(<PublicationsScreen />);
  await screen.findByTestId('pdf-viewer');
  layoutBar(80);
  act(() => mockPdfProps.onPageChange(page, 40));
}

describe('publication reader tap', () => {
  it('should hide the reader bars on a tap and bring them back on the next', async () => {
    await openReaderOnPage(12);

    act(() => mockPdfProps.onSingleTap());
    expect(screen.getByTestId('reader-top-bar', { includeHiddenElements: true }).props.pointerEvents).toBe('none');

    act(() => mockPdfProps.onSingleTap());
    expect(screen.getByTestId('reader-top-bar').props.pointerEvents).toBe('box-none');
  });

  it('should not touch the document when a tap hides the status bar and shrinks the bar', async () => {
    await openReaderOnPage(12);
    const source = mockPdfProps.source;
    mockInsets = [mockPdfProps.contentInsetTop];

    // Tap: the bars and the status bar hide; on an iPad the bar loses the status bar's height.
    act(() => mockPdfProps.onSingleTap());
    layoutBar(56);
    // Tap again: everything comes back.
    act(() => mockPdfProps.onSingleTap());
    layoutBar(80);

    expect(mockInsets).toEqual([80]);
    expect(mockPdfProps.source).toBe(source);
    expect(mockPdfProps).not.toHaveProperty('page');
    expect(mockPdfMounts).toBe(1);
  });
});
