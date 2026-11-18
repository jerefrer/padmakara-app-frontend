import React, { useEffect } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { __setDuration, __getLastSeekTo } from 'expo-audio';

import { MiniPlayer } from './MiniPlayer';
import { AudioPlayerProvider, useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import type { Track } from '@/types';

jest.mock('@/services/cacheService', () => ({
  __esModule: true,
  default: {
    getCachedTrackPath: jest.fn(async () => null),
    preCacheTracksForDuration: jest.fn(async () => undefined),
    cacheTrack: jest.fn(async () => null),
  },
}));
jest.mock('@/services/downloadService', () => ({
  __esModule: true,
  default: { getDownloadedTrackPath: jest.fn(async () => null) },
}));
jest.mock('@/services/retreatService', () => ({
  __esModule: true,
  default: {
    getTrackStreamUrl: jest.fn(async () => ({ success: true, url: 'mock://stream' })),
    isTrackAudioDenied: jest.fn(async () => false),
  },
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));
jest.mock('@/services/apiService', () => ({
  __esModule: true,
  default: {
    get: jest.fn(async () => ({ success: true, data: null })),
    post: jest.fn(async () => ({ success: true, data: {} })),
  },
}));
jest.mock('@/services/notificationPermission', () => ({ offerNotificationExplainer: jest.fn() }));
jest.mock('@/services/lockScreenArtwork', () => ({ getLockScreenArtworkUri: jest.fn(async () => null) }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'en' }),
}));
const mockPush = jest.fn();
let mockPathname = '/';
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  usePathname: () => mockPathname,
}));
jest.mock('@/hooks/useTabBarHeight', () => ({ useTabBarHeight: () => 49 }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/components/PlayingIndicator', () => ({ PlayingIndicator: () => null }));
jest.mock('@/utils/i18n', () => ({ getTrackTitle: (t: { title: string }) => t.title }));

const makeTrack = (id: string, title: string): Track => ({
  id,
  title,
  duration: 600,
  order: 0,
  session_id: 's1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const lastMeta = { retreatId: 'r7', retreatName: 'Autumn retreat', groupName: 'Lisbon' };

const saveLastPlayed = async () => {
  await AsyncStorage.setItem(
    'last_played_track',
    JSON.stringify({ track: makeTrack('tLast', 'Morning teaching'), meta: lastMeta }),
  );
  await AsyncStorage.setItem(
    'progress_tLast',
    JSON.stringify({ trackId: 'tLast', position: 150, completed: false, lastPlayed: '2026-11-17T10:00:00Z', bookmarks: [] }),
  );
};

/** Exposes the context so a test can act as an event screen would. */
type PlayerContext = ReturnType<typeof useAudioPlayerContext>;
let ctx: PlayerContext | null = null;
const keepContext = (value: PlayerContext) => { ctx = value; };
function ContextProbe({ inlinePlayer, onContext }: { inlinePlayer: boolean; onContext: (value: PlayerContext) => void }) {
  const value = useAudioPlayerContext();
  const { setInlinePlayerVisible } = value;
  useEffect(() => { onContext(value); });
  useEffect(() => { setInlinePlayerVisible(inlinePlayer); }, [inlinePlayer, setInlinePlayerVisible]);
  return null;
}

const renderApp = (inlinePlayer = false) => render(
  <AudioPlayerProvider>
    <ContextProbe inlinePlayer={inlinePlayer} onContext={keepContext} />
    <MiniPlayer />
  </AudioPlayerProvider>,
);

const flush = async () => {
  await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
};

describe('MiniPlayer after the app restarts', () => {
  beforeEach(() => {
    mockPathname = '/';
    ctx = null;
  });

  it('should show the last track, paused, when the app opens again', async () => {
    await saveLastPlayed();

    const screen = renderApp();
    await flush();

    expect(screen.getByText('Morning teaching')).toBeTruthy();
    expect(screen.getByText('Lisbon · Autumn retreat')).toBeTruthy();
    expect(screen.getByLabelText('miniPlayer.play')).toBeTruthy();
    expect(screen.getByTestId('miniplayer-progress').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: '25%' })]),
    );
  });

  it('should resume from where the person stopped when play is tapped', async () => {
    await saveLastPlayed();
    const screen = renderApp();
    await flush();

    act(() => { __setDuration(600); });
    fireEvent.press(screen.getByTestId('miniplayer-play-pause'));
    await flush();

    expect(ctx?.currentTrack?.id).toBe('tLast');
    expect(__getLastSeekTo()).toBe(150);
    expect(screen.getByLabelText('miniPlayer.pause')).toBeTruthy();
  });

  it('should stay closed after another restart once the person closed it', async () => {
    await saveLastPlayed();
    const first = renderApp();
    await flush();

    fireEvent.press(first.getByLabelText('miniPlayer.close'));
    await flush();
    expect(first.queryByTestId('miniplayer')).toBeNull();
    first.unmount();

    const second = renderApp();
    await flush();
    expect(second.queryByTestId('miniplayer')).toBeNull();
  });

  it('should open the last track\'s event when the bar is tapped', async () => {
    await saveLastPlayed();
    const screen = renderApp();
    await flush();

    fireEvent.press(screen.getByTestId('miniplayer'));

    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ params: { id: 'r7' } }));
  });

  it('should step aside while an event screen shows its own player', async () => {
    await saveLastPlayed();

    const screen = renderApp(true);
    await flush();

    expect(screen.queryByTestId('miniplayer')).toBeNull();
  });

  it('should stay out of the way on the last track\'s own event screen', async () => {
    await saveLastPlayed();
    mockPathname = '/retreat/r7/';

    const screen = renderApp();
    await flush();

    expect(screen.queryByTestId('miniplayer')).toBeNull();
  });

  it('should keep showing the last track after an event screen loaded one of its tracks paused', async () => {
    await saveLastPlayed();
    const screen = renderApp();
    await flush();

    const opened = makeTrack('tOpened', 'Opened, never played');
    act(() => {
      __setDuration(600);
      ctx?.playTrack(opened, [opened], 0, { retreatId: 'r9', retreatName: 'Spring', groupName: 'Porto' });
    });
    await flush();

    expect(screen.getByText('Morning teaching')).toBeTruthy();
  });
});
