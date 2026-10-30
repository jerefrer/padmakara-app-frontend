import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import RetreatDetailScreen from '@/app/(tabs)/(groups)/retreat/[id]';
import retreatService from '@/services/retreatService';

let mockAuth: { isAuthenticated: boolean };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '7' }),
  useFocusEffect: jest.fn(),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en', contentLanguage: 'en-pt' }),
}));
// One stable object: the screen registers callbacks on it from effects.
const mockAudio = new Proxy({} as Record<string, unknown>, {
  get: (target, key: string) =>
    key in target
      ? target[key]
      : key.startsWith('set') || ['playTrack', 'pause', 'resume', 'clearTrack', 'loadTrack'].includes(key)
        ? jest.fn()
        : undefined,
});
jest.mock('@/contexts/AudioPlayerContext', () => ({ useAudioPlayerContext: () => mockAudio }));
jest.mock('@/contexts/RelatedEventsContext', () => ({ useRelatedEvents: () => ({ setMeta: jest.fn() }) }));
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ isDesktop: false, isMobile: true }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-sharing', () => ({}));

// Heavy children that the locked screen never reaches.
jest.mock('@/components/PDFViewer', () => ({ PDFViewer: () => null }));
jest.mock('@/components/DocumentImageViewer', () => ({ DocumentImageViewer: () => null }));
jest.mock('@/components/AudioPlayer', () => ({ AudioPlayer: () => null }));
jest.mock('@/components/VideoPlayer', () => ({ VideoPlayer: () => null }));
jest.mock('@/components/LevelTrail', () => ({ LevelTrail: () => null }));
jest.mock('@/components/OfflineBadge', () => ({ OfflineBadge: () => null }));
jest.mock('@/components/DraftBadge', () => ({ DraftBadge: () => null }));
jest.mock('@/components/ReadAlongViewer', () => ({ ReadAlongViewer: () => null }));
jest.mock('@/components/VideoGrid', () => ({ VideoGrid: () => null }));
jest.mock('@/components/desktop/TrackDetailPanel', () => ({ TrackDetailPanel: () => null }));
jest.mock('@/components/ConfirmationModal', () => ({ ConfirmationModal: () => null }));
jest.mock('@/components/membership/LockedRetreat', () => {
  const { Text } = require('react-native');
  return { LockedRetreat: ({ reason }: { reason: string }) => <Text>{`locked:${reason}`}</Text> };
});

jest.mock('@/services/retreatService', () => ({
  __esModule: true,
  default: {
    getRetreatDetailsSync: jest.fn(() => null),
    getRetreatDetails: jest.fn(),
  },
  buildEventDocuments: jest.fn(() => []),
}));
jest.mock('@/services/downloadService', () => ({
  __esModule: true,
  default: {
    getDownloadingRetreatId: jest.fn(() => null),
    isRetreatDownloaded: jest.fn(() => Promise.resolve(false)),
    getDownloadProgress: jest.fn(() => null),
    subscribeToProgress: jest.fn(() => () => {}),
  },
}));
jest.mock('@/services/downloadStateService', () => ({
  __esModule: true,
  default: { subscribe: jest.fn(() => () => {}), getState: jest.fn() },
}));
jest.mock('@/services/eventBookmarkService', () => ({
  __esModule: true,
  default: { list: jest.fn(() => Promise.resolve({ success: true, data: [] })), add: jest.fn(), remove: jest.fn() },
}));
jest.mock('@/services/trackBookmarkService', () => ({
  __esModule: true,
  default: { list: jest.fn(() => Promise.resolve({ success: true, data: [] })) },
}));
jest.mock('@/services/apiService', () => ({ __esModule: true, default: {} }));

const getDetails = retreatService.getRetreatDetails as jest.Mock;

const retreat = {
  id: '7',
  name: 'Guru Yoga',
  startDate: '2025-04-26',
  sessions: [
    {
      id: 1,
      name: 'Morning',
      tracks: [{ id: 11, title: 'Initial prayers', duration: 600, order: 1, sessionId: 1, languages: ['en'] }],
    },
  ],
  relatedPublications: [{ id: 5, title: 'The Excellent Path of Liberation', coverImageUrl: null }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { isAuthenticated: true };
  getDetails.mockResolvedValue({ success: true, data: retreat });
});

describe('retreat screen related publications', () => {
  it('should not list related publications under the audio tab', async () => {
    const screen = render(<RetreatDetailScreen />);
    await screen.findByTestId('event-tab-documents');
    expect(screen.queryByTestId('event-related-publications')).toBeNull();
  });

  it('should list related publications under the texts tab, even with no other text', async () => {
    const screen = render(<RetreatDetailScreen />);
    fireEvent.press(await screen.findByTestId('event-tab-documents'));
    expect(await screen.findByTestId('event-related-publications')).toBeTruthy();
    expect(screen.getByText('The Excellent Path of Liberation')).toBeTruthy();
    expect(screen.queryByText('No documents available')).toBeNull();
  });
});
