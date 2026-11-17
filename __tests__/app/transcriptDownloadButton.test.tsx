import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';

import TranscriptViewerScreen from '@/app/(tabs)/(groups)/transcript/[id]';
import { downloadFileWeb } from '@/utils/downloadFileWeb';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '42' }),
  router: { back: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
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
jest.mock('@/components/PDFViewer', () => {
  const { Text } = require('react-native');
  const { forwardRef } = require('react');
  return {
    PDFViewer: forwardRef(({ source, showDownloadButton }: { source: string; showDownloadButton?: boolean }, _ref: any) => (
      <Text testID="pdf-viewer" accessibilityHint={`toolbar download: ${showDownloadButton ?? true}`}>
        {source}
      </Text>
    )),
  };
});
jest.mock('@/utils/downloadFileWeb', () => ({ downloadFileWeb: jest.fn(() => Promise.resolve()) }));
jest.mock('@/services/transcriptCacheService', () => ({
  transcriptCacheService: { getCachedFilePath: jest.fn(() => Promise.resolve('file:///cache/t-7.pdf')) },
}));
jest.mock('@/services/retreatService', () => ({
  __esModule: true,
  transcriptErrorKey: () => 'transcript.loadError',
  default: {
    getRetreatDetails: jest.fn(() =>
      Promise.resolve({
        success: true,
        data: { name: 'Spring Retreat', transcripts: [{ id: 7, language: 'en', updatedAt: '2025-01-01' }] },
      }),
    ),
    getTranscriptPdfUrl: jest.fn(() => Promise.resolve({ success: true, url: 'blob:transcript' })),
  },
}));

const original = Platform.OS;

beforeEach(() => {
  (Platform as any).OS = 'ios';
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
});
afterAll(() => {
  (Platform as any).OS = original;
});

describe('transcript viewer download button', () => {
  it('should turn off the grey toolbar download button of the viewer', async () => {
    const screen = render(<TranscriptViewerScreen />);

    const viewer = await screen.findByTestId('pdf-viewer');

    expect(viewer.props.accessibilityHint).toBe('toolbar download: false');
  });

  it('should download the transcript from the red header button on the web', async () => {
    (Platform as any).OS = 'web';
    const screen = render(<TranscriptViewerScreen />);

    fireEvent.press(await screen.findByLabelText('Download PDF'));

    await waitFor(() =>
      expect(downloadFileWeb).toHaveBeenCalledWith('blob:transcript', 'Spring Retreat — Transcript.pdf'),
    );
  });

  it('should open the share sheet from the red header button on a phone', async () => {
    const screen = render(<TranscriptViewerScreen />);

    fireEvent.press(await screen.findByLabelText('Share or save this text'));

    await waitFor(() =>
      expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/t-7.pdf', {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      }),
    );
  });
});
