import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import TranscriptViewerScreen from '@/app/(tabs)/(groups)/transcript/[id]';
import retreatService from '@/services/retreatService';

let mockParams: Record<string, string> = {};
let mockPdfProps: any;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: { back: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
// Signed out: the reader state lives on this device only.
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
jest.mock('@/hooks/useReaderBars', () => ({ useReaderBars: () => ({ barsHidden: false, toggleBars: jest.fn() }) }));
jest.mock('@/hooks/useUnlockedOrientation', () => ({ useUnlockedOrientation: () => undefined }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('@/components/PDFViewer', () => {
  const { View } = require('react-native');
  const { forwardRef } = require('react');
  return {
    PDFViewer: forwardRef((props: any, _ref: any) => {
      mockPdfProps = props;
      return <View testID="pdf-viewer" />;
    }),
  };
});
jest.mock('@/services/retreatService', () => ({
  __esModule: true,
  transcriptErrorKey: () => 'transcript.loadError',
  default: {
    getRetreatDetails: jest.fn(() =>
      Promise.resolve({
        success: true,
        data: {
          name: 'Spring Retreat',
          transcripts: [
            { id: 7, language: 'en', updatedAt: '2025-01-01', pageCount: 60 },
            { id: 8, language: 'pt', updatedAt: '2025-01-01', pageCount: 60 },
          ],
        },
      }),
    ),
    getTranscriptPdfUrl: jest.fn(() => Promise.resolve({ success: true, url: 'blob:transcript' })),
  },
}));

const original = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: '42' };
  mockPdfProps = undefined;
  (Platform as any).OS = 'ios';
});
afterAll(() => {
  (Platform as any).OS = original;
});

describe('transcript reader — resume and page bookmarks', () => {
  it('should reopen the transcript on the page the reader left', async () => {
    await AsyncStorage.setItem('@reader:position:transcript:7', JSON.stringify({ page: 22, at: 1000 }));

    render(<TranscriptViewerScreen />);
    await screen.findByTestId('pdf-viewer');

    expect(mockPdfProps.initialPage).toBe(22);
  });

  it('should open the transcript and page a bookmark link asks for', async () => {
    mockParams = { id: '42', transcript: '8', page: '9' };

    render(<TranscriptViewerScreen />);
    await screen.findByTestId('pdf-viewer');

    expect(retreatService.getTranscriptPdfUrl).toHaveBeenCalledWith('8', '2025-01-01', undefined);
    expect(mockPdfProps.initialPage).toBe(9);
  });

  it('should bookmark the page on screen and list it', async () => {
    render(<TranscriptViewerScreen />);
    await screen.findByTestId('pdf-viewer');
    act(() => mockPdfProps.onPageChange(14, 60));

    await act(async () => fireEvent.press(screen.getByLabelText('Bookmark this page')));
    fireEvent.press(screen.getByTestId('transcript-contents-button'));

    expect(screen.getByText('Page 14')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('@reader:bookmarks:anon:transcript:7')) ?? '{}').pages).toEqual([14]);
  });
});
