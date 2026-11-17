import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { DESKTOP_ROW_RULE_COLOR } from '@/components/EventRow';
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
const mockAudio = new Proxy({ currentTrack: { id: 11 } } as Record<string, unknown>, {
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
jest.mock('@/components/VideoPlayer', () => ({ VideoPlayer: () => null }));
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
  teachers: [{ id: 3, name: 'Tenga Rinpoche', heroUrl: 'https://img.example/hero.webp' }],
  sessions: [
    {
      id: 1,
      name: 'Morning',
      tracks: [
        { id: 11, title: 'Playing prayer', duration: 600, order: 1, sessionId: 1, languages: ['tib', 'en'] },
        { id: 12, title: 'Idle prayer', duration: 600, order: 2, sessionId: 1, languages: ['en'] },
      ],
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { isAuthenticated: true };
  mockLayout = { isDesktop: true, isMobile: false };
  getDetails.mockResolvedValue({ success: true, data: retreat });
});

describe('retreat screen desktop header', () => {
  it('should show a square photo with the event details beside it on desktop', async () => {
    const screen = render(<RetreatDetailScreen />);
    await screen.findByTestId('event-desktop-header');
    expect(StyleSheet.flatten(screen.getByTestId('event-desktop-hero').props.style).aspectRatio).toBe(1);
    expect(screen.getAllByText('Guru Yoga').length).toBeGreaterThan(0);
  });

  it('should put the bookmark beside the photo as a plain icon instead of a floating dark circle', async () => {
    const screen = render(<RetreatDetailScreen />);
    await screen.findByTestId('event-desktop-header');
    const style = StyleSheet.flatten(screen.getByTestId('event-bookmark-button').props.style);
    expect(style.position).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();
  });

  it('should keep the full-width hero and floating buttons on a phone', async () => {
    mockLayout = { isDesktop: false, isMobile: true };
    const screen = render(<RetreatDetailScreen />);
    await screen.findAllByText('Guru Yoga');
    expect(screen.queryByTestId('event-desktop-header')).toBeNull();
    const style = StyleSheet.flatten(screen.getByTestId('event-bookmark-button').props.style);
    expect(style.backgroundColor).toBe('rgba(0,0,0,0.35)');
  });
});

describe('retreat screen track list', () => {
  it('should draw the home list lines on desktop: flush left, a gap on the right', async () => {
    const screen = render(<RetreatDetailScreen />);
    await screen.findByText('Idle prayer');
    const style = StyleSheet.flatten(screen.getByTestId('track-row-12').props.style);
    expect(style.marginLeft).toBe(-16);
    expect(style.marginRight).toBe(80);
    expect(style.borderBottomColor).toBe(DESKTOP_ROW_RULE_COLOR);
  });

  it('should show the Tibetan tag in neutral grey without a highlight colour', async () => {
    const screen = render(<RetreatDetailScreen />);
    await screen.findByText('Idle prayer');
    const tib = screen.getByText('TIB');
    expect(StyleSheet.flatten(tib.props.style).color).toBe('#6b7280');
  });
});
