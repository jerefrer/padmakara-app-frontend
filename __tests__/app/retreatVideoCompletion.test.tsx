import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

import RetreatDetailScreen from '@/app/(tabs)/(groups)/retreat/[id]';
import retreatService from '@/services/retreatService';

let mockAuth: { isAuthenticated: boolean };
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '7' }),
  useFocusEffect: jest.fn(),
  router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn(), back: jest.fn() },
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
// The latest props the screen gave the video player.
let mockVideoPlayerProps: any;
jest.mock('@/components/VideoPlayer', () => ({
  VideoPlayer: (props: any) => {
    mockVideoPlayerProps = props;
    return null;
  },
}));
jest.mock('@/components/PlayingIndicator', () => ({ PlayingIndicator: () => null }));
jest.mock('@/components/OfflineBadge', () => ({ OfflineBadge: () => null }));
jest.mock('@/components/DraftBadge', () => ({ DraftBadge: () => null }));
jest.mock('@/components/ReadAlongViewer', () => ({ ReadAlongViewer: () => null }));
jest.mock('@/components/VideoGrid', () => {
  const { Text } = require('react-native');
  return {
    VideoGrid: ({ items, onPlay }: any) => (
      <Text testID="play-first-video" onPress={() => onPlay(items[0].video ?? items[0])}>play</Text>
    ),
  };
});
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

const video = { id: 7, sessionId: 1, title: 'Morning teaching', durationSeconds: 5533 };
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
  videos: [video],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { isAuthenticated: true };
  mockVideoPlayerProps = undefined;
  getDetails.mockResolvedValue({ success: true, data: retreat });
});

describe('retreat screen video completion', () => {
  // Completion fires at 97% of the video. Closing the player then cut the last
  // minutes and, on iOS in full screen, left a blank white screen.
  it('should keep the video open when it is marked as watched', async () => {
    const screen = render(<RetreatDetailScreen />);
    fireEvent.press(await screen.findByTestId('event-tab-video'));
    fireEvent.press(await screen.findByTestId('play-first-video'));
    expect(mockVideoPlayerProps.video).toBeTruthy();

    act(() => mockVideoPlayerProps.onComplete?.());

    expect(mockVideoPlayerProps.video).toBeTruthy();
  });

  it('should close the video when the viewer closes it', async () => {
    const screen = render(<RetreatDetailScreen />);
    fireEvent.press(await screen.findByTestId('event-tab-video'));
    fireEvent.press(await screen.findByTestId('play-first-video'));

    act(() => mockVideoPlayerProps.onClose());

    expect(mockVideoPlayerProps.video).toBeNull();
  });
});
