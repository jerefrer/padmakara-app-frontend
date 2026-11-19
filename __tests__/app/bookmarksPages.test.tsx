import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import BookmarksScreen from '@/app/(tabs)/bookmarks';
import { readerStateService } from '@/services/readerStateService';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { push: jest.fn() },
    // Run the focus callback once, as on the first focus.
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
  };
});
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'pt' }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/services/eventBookmarkService', () => ({
  __esModule: true,
  default: { list: jest.fn(() => Promise.resolve({ success: true, data: [] })) },
}));
jest.mock('@/services/trackBookmarkService', () => ({
  __esModule: true,
  default: { list: jest.fn(() => Promise.resolve({ success: true, data: [] })) },
}));
jest.mock('@/services/videoBookmarkService', () => ({
  __esModule: true,
  default: { list: jest.fn(() => Promise.resolve({ success: true, data: [] })) },
}));
jest.mock('@/services/readerStateService', () => ({
  readerStateService: { listAllBookmarks: jest.fn() },
}));

const publicationBookmark = {
  documentType: 'publication',
  documentId: 5,
  page: 12,
  createdAt: '2026-11-19T10:00:00.000Z',
  document: { type: 'publication', id: 5, title: 'O Tesouro de Bênçãos' },
};
const transcriptBookmark = {
  documentType: 'transcript',
  documentId: 9,
  page: 20,
  createdAt: '2026-11-18T10:00:00.000Z',
  document: { type: 'transcript', id: 9, language: 'pt', event: { id: 3, titleEn: 'Spring retreat', titlePt: 'Retiro da primavera' } },
};

beforeEach(() => {
  jest.clearAllMocks();
  (readerStateService.listAllBookmarks as jest.Mock).mockResolvedValue({
    success: true,
    data: [publicationBookmark, transcriptBookmark],
  });
});

describe('Bookmarks tab — pages', () => {
  it('should list bookmarked pages of publications and transcripts', async () => {
    render(<BookmarksScreen />);

    expect(await screen.findByText('O Tesouro de Bênçãos')).toBeTruthy();
    expect(screen.getByText('Publication · page 12')).toBeTruthy();
    expect(screen.getByText('Retiro da primavera')).toBeTruthy();
    expect(screen.getByText('Transcript · page 20')).toBeTruthy();
  });

  it('should open a publication on its bookmarked page', async () => {
    render(<BookmarksScreen />);

    fireEvent.press(await screen.findByTestId('page-bookmark-publication-5-12'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/(groups)/publications',
      params: { open: '5', page: '12' },
    });
  });

  it('should open the bookmarked transcript of the event on its page', async () => {
    render(<BookmarksScreen />);

    fireEvent.press(await screen.findByTestId('page-bookmark-transcript-9-20'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/(groups)/transcript/[id]',
      params: { id: '3', transcript: '9', page: '20' },
    });
  });
});
