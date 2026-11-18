import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import RetreatDetailScreen from '@/app/(tabs)/(groups)/retreat/[id]';
import retreatService from '@/services/retreatService';

let mockAuth: { isAuthenticated: boolean };
const mockPush = jest.fn();
let mockParams: Record<string, string> = { id: '7' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
  router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn(), back: jest.fn() },
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en', contentLanguage: 'en-pt' }),
}));
// One stable object: the screen registers callbacks on it from effects.
// `mockAudioState` holds what each test sets (current track, listening state).
const mockPlayTrack = jest.fn();
const mockTogglePlayPause = jest.fn();
let mockAudioState: Record<string, unknown> = {};
const mockAudio = new Proxy({} as Record<string, unknown>, {
  get: (target, key: string) =>
    key === 'playTrack'
      ? mockPlayTrack
      : key === 'togglePlayPause'
      ? mockTogglePlayPause
      : key in mockAudioState
      ? mockAudioState[key]
      : key.startsWith('set') || ['playTrack', 'pause', 'resume', 'clearTrack', 'loadTrack'].includes(key)
        ? jest.fn()
        : undefined,
});
jest.mock('@/contexts/AudioPlayerContext', () => ({ useAudioPlayerContext: () => mockAudio }));
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
jest.mock('@/contexts/VideoSessionContext', () => ({ useVideoSession: () => ({ openVideo: jest.fn() }) }));
jest.mock('@/components/PlayingIndicator', () => ({ PlayingIndicator: () => null }));
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
};

/** The track the player holds from another event, Lisbon's spring retreat. */
const otherEventTrack = { id: 99, title: 'Another teaching', duration: 900 };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: '7' };
  mockAuth = { isAuthenticated: true };
  getDetails.mockResolvedValue({ success: true, data: retreat });
});

describe('retreat screen loading its track into the player', () => {
  // Inês: a track an event page had only loaded followed her to every other
  // teaching. Such a preview is replaced by this event's own track.
  it('should load its own track when the player only holds a preview from another event', async () => {
    mockAudioState = { currentTrack: otherEventTrack, retreatId: '5', listeningStarted: false };

    render(<RetreatDetailScreen />);

    await waitFor(() => expect(mockPlayTrack).toHaveBeenCalled());
    expect(mockPlayTrack.mock.calls[0][0].id).toBe(11);
  });

  it('should leave alone a track from another event the person is listening to', async () => {
    mockAudioState = { currentTrack: otherEventTrack, retreatId: '5', listeningStarted: true };

    const screen = render(<RetreatDetailScreen />);
    await screen.findByText('Initial prayers');
    await waitFor(() => expect(getDetails).toHaveBeenCalled());

    expect(mockPlayTrack).not.toHaveBeenCalled();
  });

  // André: returning to a teaching started its audio by itself.
  it('should load its track paused when the player is empty', async () => {
    mockAudioState = { currentTrack: null, retreatId: null, listeningStarted: false };

    render(<RetreatDetailScreen />);

    await waitFor(() => expect(mockPlayTrack).toHaveBeenCalled());
    expect(mockPlayTrack.mock.calls[0][4]).toEqual({ autoPlay: false });
  });
});

describe('retreat screen opened from a bookmark', () => {
  const twoTracks = {
    ...retreat,
    sessions: [{
      ...retreat.sessions[0],
      tracks: [
        ...retreat.sessions[0].tracks,
        { id: 12, title: 'Main teaching', duration: 900, order: 2, sessionId: 1, languages: ['en'] },
      ],
    }],
  };

  beforeEach(() => {
    mockParams = { id: '7', from: 'bookmarks', trackId: '12' };
    getDetails.mockResolvedValue({ success: true, data: twoTracks });
  });

  it('should load and play the bookmarked track when the player is empty', async () => {
    mockAudioState = { currentTrack: null, retreatId: null, listeningStarted: false, isPlaying: false };

    render(<RetreatDetailScreen />);

    await waitFor(() => expect(mockPlayTrack).toHaveBeenCalled());
    expect(mockPlayTrack.mock.calls[0][0].id).toBe(12);
    expect(mockPlayTrack.mock.calls[0][4]).toEqual({ autoPlay: true });
  });

  it('should switch to the bookmarked track when another track of this event is loaded', async () => {
    mockAudioState = {
      currentTrack: { id: 11, title: 'Initial prayers', duration: 600 },
      retreatId: '7',
      listeningStarted: true,
      isPlaying: false,
    };

    render(<RetreatDetailScreen />);

    await waitFor(() => expect(mockPlayTrack).toHaveBeenCalled());
    expect(mockPlayTrack.mock.calls[0][0].id).toBe(12);
    expect(mockPlayTrack.mock.calls[0][4]).toEqual({ autoPlay: true });
  });

  it('should play the bookmarked track when it is already loaded but paused', async () => {
    mockAudioState = {
      currentTrack: { id: 12, title: 'Main teaching', duration: 900 },
      retreatId: '7',
      listeningStarted: true,
      isPlaying: false,
    };

    const screen = render(<RetreatDetailScreen />);
    await screen.findByText('Main teaching');

    await waitFor(() => expect(mockTogglePlayPause).toHaveBeenCalledTimes(1));
    expect(mockPlayTrack).not.toHaveBeenCalled();
  });
});
