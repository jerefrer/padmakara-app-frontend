import React, { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { VideoHost } from '@/components/VideoHost';
import { useVideoSession, VideoSessionProvider } from '@/contexts/VideoSessionContext';
import { useEventListener } from 'expo';

const mockPlayer: Record<string, any> = {
  subtitleTrack: undefined,
  replace: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  currentTime: 0,
  duration: 0,
  showNowPlayingNotification: true,
};
// The props the video view last received.
const mockVideoView: { props: Record<string, any> } = { props: {} };
// Counts the players created: leaving the screen must not create (and so
// restart) another one.
let mockPlayersCreated = 0;
const mockSetVideoPlaying = jest.fn();
let mockAudioPlaying = false;

jest.mock('expo-video', () => {
  const { useState } = require('react');
  return {
    useVideoPlayer: () =>
      useState(() => {
        mockPlayersCreated += 1;
        return mockPlayer;
      })[0],
    VideoView: (props: Record<string, any>) => {
      mockVideoView.props = props;
      return null;
    },
  };
});
jest.mock('@/modules/device-rotation', () => ({ subscribeToDeviceRotation: () => () => undefined }));
jest.mock('expo', () => ({ useEventListener: jest.fn() }));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(() => Promise.resolve({ type: 'WIFI' })),
  NetworkStateType: { CELLULAR: 'CELLULAR', WIFI: 'WIFI' },
}));
jest.mock('expo-screen-orientation', () => ({
  lockAsync: jest.fn(() => Promise.resolve()),
  unlockAsync: jest.fn(() => Promise.resolve()),
  OrientationLock: { PORTRAIT_UP: 1 },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
jest.mock('@/contexts/AudioPlayerContext', () => ({
  useAudioPlayerContext: () => ({ isPlaying: mockAudioPlaying, setVideoPlaying: mockSetVideoPlaying }),
}));
jest.mock('@/components/MiniPlayer', () => ({ useBottomBarsSpace: () => 125 }));
jest.mock('@/components/WebHlsVideo', () => ({ WebHlsVideo: () => null }));
jest.mock('@/services/lockScreenArtwork', () => ({
  getLockScreenArtworkUri: jest.fn(() => Promise.resolve('file:///bundle/lockscreen-artwork.png')),
}));
jest.mock('@/services/retreatService', () => ({
  __esModule: true,
  default: {
    fetchVideo: jest.fn(() => Promise.resolve({ success: true, proxyHls: 'https://api.example/hls/7.m3u8' })),
  },
}));
const mockStore = new Map<string, any>();
jest.mock('@/services/progressService', () => ({
  __esModule: true,
  default: {
    getProgress: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
    getVideoProgressRemote: jest.fn(() => Promise.resolve(null)),
    saveProgress: jest.fn((p: any) => {
      mockStore.set(p.trackId, p);
      return Promise.resolve();
    }),
    saveVideoProgressRemote: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('@/services/videoDownloadService', () => ({
  __esModule: true,
  default: { getLocalUri: jest.fn(() => Promise.resolve(null)), download: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/services/videoPreferencesService', () => ({
  __esModule: true,
  default: {
    getAllowOnCellular: jest.fn(() => Promise.resolve(true)),
    getWarnOnCellular: jest.fn(() => Promise.resolve(false)),
    getSubtitleLanguage: jest.fn(() => Promise.resolve(null)),
  },
}));

const video = {
  id: 24,
  titleEn: 'video 1',
  durationSeconds: 6925,
  posterUrl: 'https://vz.example/24/thumbnail.jpg',
} as any;
const EVENT_ARTWORK = 'https://api.example/events/7/artwork.jpg';

/** Stands in for the event screen: opens the video when it mounts. */
function EventScreen({ openKey = 0, artworkUrl }: { openKey?: number; artworkUrl: string | null }) {
  const { openVideo } = useVideoSession();
  useEffect(() => {
    // A fresh copy, as a reloaded event payload would give.
    openVideo({
      video: { ...video },
      eventId: '7',
      eventTitle: 'Guru Yoga',
      videos: [video],
      teacherNames: 'Jigme Khyentse Rinpoche',
      artworkUrl,
    });
  }, [openVideo, openKey, artworkUrl]);
  return null;
}

function App({
  onEventScreen,
  openKey,
  artworkUrl = EVENT_ARTWORK,
}: {
  onEventScreen: boolean;
  openKey?: number;
  artworkUrl?: string | null;
}) {
  return (
    <VideoSessionProvider>
      {onEventScreen ? <EventScreen openKey={openKey} artworkUrl={artworkUrl} /> : null}
      <VideoHost />
    </VideoSessionProvider>
  );
}

const handlerFor = (event: string) => {
  const calls = (useEventListener as jest.Mock).mock.calls.filter(([, name]) => name === event);
  return calls[calls.length - 1][2] as (payload: any) => void;
};
const setPlaying = (isPlaying: boolean) => act(async () => handlerFor('playingChange')({ isPlaying }));

describe('VideoHost — the video keeps playing while the viewer moves around the app', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clear();
    mockPlayersCreated = 0;
    mockAudioPlaying = false;
    mockPlayer.duration = 6925;
    mockPlayer.currentTime = 0;
    mockPlayer.showNowPlayingNotification = true;
    mockVideoView.props = {};
  });

  const openAndPlay = async () => {
    const view = render(<App onEventScreen />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledTimes(1));
    await setPlaying(true);
    return view;
  };

  it('should move a playing video into the floating window when its page is left', async () => {
    const view = await openAndPlay();
    mockPlayer.pause.mockClear();

    fireEvent.press(view.getByTestId('video-close'));

    expect(view.getByTestId('video-floating')).toBeTruthy();
    expect(view.queryByTestId('video-page')).toBeNull();
    expect(mockPlayer.pause).not.toHaveBeenCalled();
  });

  it('should float the window above the tab bar and the audio bar', async () => {
    const view = await openAndPlay();

    fireEvent.press(view.getByTestId('video-close'));

    expect(view.getByTestId('video-floating')).toHaveStyle({ bottom: 125 });
  });

  it('should keep the same player and source when the screen that opened it unmounts', async () => {
    const view = await openAndPlay();
    fireEvent.press(view.getByTestId('video-close'));
    mockPlayer.pause.mockClear();

    view.rerender(<App onEventScreen={false} />);
    await act(async () => undefined);

    expect(view.getByTestId('video-floating')).toBeTruthy();
    expect(mockPlayersCreated).toBe(1);
    expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
    expect(mockPlayer.pause).not.toHaveBeenCalled();
  });

  it('should return to the same player on its page when the floating window is expanded', async () => {
    const view = await openAndPlay();
    fireEvent.press(view.getByTestId('video-close'));
    view.rerender(<App onEventScreen={false} />);

    fireEvent.press(view.getByTestId('video-floating-expand'));

    expect(view.getByTestId('video-page')).toBeTruthy();
    expect(view.queryByTestId('video-floating')).toBeNull();
    expect(mockPlayersCreated).toBe(1);
    expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
  });

  it('should pause, save the position and close when the floating window is closed', async () => {
    const view = await openAndPlay();
    fireEvent.press(view.getByTestId('video-close'));
    mockPlayer.currentTime = 42;

    fireEvent.press(view.getByTestId('video-floating-close'));
    await act(async () => undefined);

    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockStore.get('video-24')?.position).toBe(42);
    expect(view.queryByTestId('video-floating')).toBeNull();
    expect(view.queryByTestId('video-player-root')).toBeNull();
  });

  it('should close a paused video when its page is left', async () => {
    const view = await openAndPlay();
    await setPlaying(false);

    fireEvent.press(view.getByTestId('video-close'));

    expect(view.queryByTestId('video-floating')).toBeNull();
    expect(view.queryByTestId('video-player-root')).toBeNull();
  });

  it('should toggle playback from the floating window', async () => {
    const view = await openAndPlay();
    fireEvent.press(view.getByTestId('video-close'));
    mockPlayer.pause.mockClear();

    fireEvent.press(view.getByTestId('video-floating-play-pause'));
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);

    await setPlaying(false);
    fireEvent.press(view.getByTestId('video-floating-play-pause'));
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it('should bring the page back without reloading when the floating video is opened again', async () => {
    const view = await openAndPlay();
    fireEvent.press(view.getByTestId('video-close'));

    view.rerender(<App onEventScreen openKey={1} />);
    await act(async () => undefined);

    expect(view.getByTestId('video-page')).toBeTruthy();
    expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
  });

  it('should keep the video open when it counts as watched', async () => {
    const view = await openAndPlay();
    mockPlayer.currentTime = 6900;

    await act(async () => handlerFor('timeUpdate')({ currentTime: 6900 }));

    expect(view.getByTestId('video-page')).toBeTruthy();
  });

  it('should pause the floating video when audio starts', async () => {
    const view = await openAndPlay();
    fireEvent.press(view.getByTestId('video-close'));
    expect(mockSetVideoPlaying).toHaveBeenLastCalledWith(true);
    mockPlayer.pause.mockClear();

    mockAudioPlaying = true;
    view.rerender(<App onEventScreen={false} />);

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  });
});

describe('VideoHost floating window layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAudioPlaying = false;
  });

  const openFloating = async () => {
    const view = render(<App onEventScreen />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledTimes(1));
    await setPlaying(true);
    fireEvent.press(view.getByTestId('video-close'));
    return view;
  };

  it('should show only the video in a 16:9 window with no bar above it', async () => {
    const view = await openFloating();

    const window = StyleSheet.flatten(view.getByTestId('video-floating').props.style);
    const frame = StyleSheet.flatten(view.getByTestId('video-frame').props.style);
    expect(window.height).toBe(Math.round((window.width * 9) / 16));
    // The video fills the whole window: same explicit size, nothing above it.
    expect(frame.width).toBe(window.width);
    expect(frame.height).toBe(window.height);
    expect(window.padding).toBe(0);
    expect(view.queryByTestId('video-close-bar')).toBeNull();
    expect(mockVideoView.props.contentFit).toBe('contain');
    expect(mockVideoView.props.nativeControls).toBe(false);
  });

  it('should draw close, expand and play/pause over the video', async () => {
    const view = await openFloating();

    expect(StyleSheet.flatten(view.getByTestId('video-floating-controls').props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    });
    expect(StyleSheet.flatten(view.getByTestId('video-floating-close').props.style)).toMatchObject({
      position: 'absolute',
      left: 6,
    });
    expect(StyleSheet.flatten(view.getByTestId('video-floating-expand').props.style)).toMatchObject({
      position: 'absolute',
      right: 6,
    });
    expect(view.getByTestId('video-floating-play-pause')).toBeTruthy();
  });

  it('should give the video its page size back when expanded', async () => {
    const view = await openFloating();

    fireEvent.press(view.getByTestId('video-floating-expand'));

    const frame = StyleSheet.flatten(view.getByTestId('video-frame').props.style);
    expect(frame.width).toBe('100%');
    expect(frame.height).toBeGreaterThan(0);
    expect(view.getByTestId('video-page')).toBeTruthy();
  });
});

describe('VideoHost Now Playing', () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks();
    mockAudioPlaying = false;
    mockPlayer.showNowPlayingNotification = true;
    (Platform as { OS: string }).OS = 'ios';
  });
  afterEach(() => {
    jest.useRealTimers();
    (Platform as { OS: string }).OS = originalOS;
  });

  const openAndPlay = async (app: React.ReactElement = <App onEventScreen />) => {
    const view = render(app);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledTimes(1));
    await setPlaying(true);
    return view;
  };

  it('should load the video with its title, teachers and event artwork for the lock screen', async () => {
    await openAndPlay();

    expect(mockPlayer.replace).toHaveBeenCalledWith({
      uri: 'https://api.example/hls/7.m3u8',
      metadata: {
        title: 'Guru Yoga · video 1',
        artist: 'Jigme Khyentse Rinpoche',
        artwork: EVENT_ARTWORK,
      },
    });
  });

  it('should fall back to the video poster when the event has no artwork', async () => {
    await openAndPlay(<App onEventScreen artworkUrl={null} />);

    expect(mockPlayer.replace.mock.calls[0][0].metadata.artwork).toBe('https://vz.example/24/thumbnail.jpg');
  });

  it('should release the lock screen when audio starts', async () => {
    const view = await openAndPlay();

    mockAudioPlaying = true;
    view.rerender(<App onEventScreen />);

    expect(mockPlayer.showNowPlayingNotification).toBe(false);
  });

  it('should claim the lock screen back when the video plays after audio', async () => {
    jest.useFakeTimers();
    const view = await openAndPlay();
    act(() => jest.advanceTimersByTime(600));
    mockAudioPlaying = true;
    view.rerender(<App onEventScreen />);
    expect(mockPlayer.showNowPlayingNotification).toBe(false);

    mockAudioPlaying = false;
    view.rerender(<App onEventScreen />);
    await setPlaying(true);
    act(() => jest.advanceTimersByTime(600));

    expect(mockPlayer.showNowPlayingNotification).toBe(true);
  });
});
