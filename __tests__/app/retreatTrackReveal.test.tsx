import React from 'react';
import { ScrollView } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestTrackReveal } from '@/utils/trackReveal';
import RetreatDetailScreen from '@/app/(tabs)/(groups)/retreat/[id]';
import retreatService from '@/services/retreatService';

let mockAuth: { isAuthenticated: boolean };
let mockLayout: Record<string, unknown>;
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '7' }),
  useFocusEffect: jest.fn(),
  router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en', contentLanguage: 'en-pt' }),
}));
// One stable object: the screen registers callbacks on it from effects.
const mockAudio = new Proxy({ currentTrack: { id: 13 }, isPlaying: false } as Record<string, unknown>, {
  get: (target, key: string) =>
    key in target
      ? target[key]
      : key.startsWith('set') || ['playTrack', 'pause', 'resume', 'clearTrack', 'loadTrack'].includes(key)
        ? jest.fn()
        : undefined,
});
jest.mock('@/contexts/AudioPlayerContext', () => ({ useAudioPlayerContext: () => mockAudio }));
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => mockLayout }));
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

const tracks = [11, 12, 13].map((id, i) => ({
  id,
  title: `Prayer ${id}`,
  duration: 600,
  order: i + 1,
  sessionId: 1,
  languages: ['en'],
}));
const retreat = { id: '7', name: 'Guru Yoga', startDate: '2025-04-26', sessions: [{ id: 1, name: 'Morning', tracks }] };

let scrollTo: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { isAuthenticated: true };
  mockLayout = { isDesktop: true, isMobile: false };
  mockAudio.currentTrack = { id: 13 };
  mockAudio.isPlaying = false;
  getDetails.mockResolvedValue({ success: true, data: retreat });
  scrollTo = jest.spyOn(ScrollView.prototype as any, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => scrollTo.mockRestore());

/** Lays the list out: a 300px viewport over rows 200px apart, starting at 400. */
async function renderLaidOut() {
  const screen = render(<RetreatDetailScreen />);
  await screen.findByText('Prayer 13');
  fireEvent(screen.getByTestId('event-scroll'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 800, height: 300 } } });
  tracks.forEach((t, i) =>
    fireEvent(screen.getByTestId(`track-row-${t.id}`), 'layout', {
      nativeEvent: { layout: { x: 0, y: 400 + i * 200, width: 800, height: 80 } },
    }),
  );
  return screen;
}

describe.each([
  ['desktop', { isDesktop: true, isMobile: false }],
  ['phone', { isDesktop: false, isMobile: true }],
])('event page opened on the %s', (_name, layout) => {
  beforeEach(() => {
    mockLayout = layout;
  });

  it('should stay at the top when the player already holds one of its tracks', async () => {
    await renderLaidOut();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('should stay at the top when it remembers the last track played there', async () => {
    mockAudio.currentTrack = null;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('13');
    await renderLaidOut();
    await act(async () => {});
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('should centre the track when a player asks to show it', async () => {
    await renderLaidOut();
    act(() => requestTrackReveal(13));
    // Row 13 spans 800-880 in a 300px viewport: centred at 840 - 150.
    expect(scrollTo).toHaveBeenCalledWith({ y: 690, animated: false });
  });

  it('should centre the track a player asked for before the page opened', async () => {
    requestTrackReveal(13);
    await renderLaidOut();
    expect(scrollTo).toHaveBeenCalledWith({ y: 690, animated: false });
  });

  it('should bring the track into view when play is pressed and it is out of sight', async () => {
    const screen = await renderLaidOut();
    mockAudio.isPlaying = true;
    screen.rerender(<RetreatDetailScreen />);
    expect(scrollTo).toHaveBeenCalledWith({ y: 690, animated: false });
  });

  it('should leave the list alone when play is pressed on a track in view', async () => {
    mockAudio.currentTrack = { id: 11 };
    const screen = await renderLaidOut();
    fireEvent(screen.getByTestId('event-scroll'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 800, height: 1200 } } });
    mockAudio.isPlaying = true;
    screen.rerender(<RetreatDetailScreen />);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
