import React from 'react';
import { Text } from 'react-native';
import { render, waitFor, act } from '@testing-library/react-native';

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
  get: (target, key: string) => (key in target ? target[key] : key.startsWith('set') ? jest.fn() : undefined),
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
jest.mock('@/components/AnimatedPlayingBars', () => ({ AnimatedPlayingBars: () => null }));
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

const locked = (reason: 'auth' | 'membership') =>
  Promise.resolve({ success: false, locked: { reason, preview: null } });

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { isAuthenticated: false };
});

describe('retreat screen after sign-in', () => {
  it('should fetch once on mount and show the locked state', async () => {
    getDetails.mockReturnValue(locked('auth'));
    const { findByText } = render(<RetreatDetailScreen />);
    expect(await findByText('locked:auth')).toBeTruthy();
    expect(getDetails).toHaveBeenCalledTimes(1);
  });

  it('should fetch the retreat again when the viewer signs in, replacing the stale lock', async () => {
    getDetails.mockReturnValueOnce(locked('auth')).mockReturnValueOnce(locked('membership'));
    const screen = render(<RetreatDetailScreen />);
    expect(await screen.findByText('locked:auth')).toBeTruthy();
    expect(getDetails).toHaveBeenCalledTimes(1);

    mockAuth = { isAuthenticated: true };
    await act(async () => screen.rerender(<RetreatDetailScreen />));

    await waitFor(() => expect(getDetails).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('locked:membership')).toBeTruthy();
    expect(screen.queryByText('locked:auth')).toBeNull();
  });

  it('should not fetch again on a re-render when the sign-in state has not changed', async () => {
    getDetails.mockReturnValue(locked('auth'));
    const screen = render(<RetreatDetailScreen />);
    await screen.findByText('locked:auth');
    await act(async () => screen.rerender(<RetreatDetailScreen />));
    expect(getDetails).toHaveBeenCalledTimes(1);
  });
});
