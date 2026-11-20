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
  playing: false,
  showNowPlayingNotification: false,
};
const mockView = {
  startPictureInPicture: jest.fn(() => Promise.resolve()),
  stopPictureInPicture: jest.fn(() => Promise.resolve()),
  enterFullscreen: jest.fn(() => Promise.resolve()),
};
const mockViewState: { props: Record<string, any> } = { props: {} };
let mockPipSupported = true;
const mockSetVideoPlaying = jest.fn();
let mockAudioPlaying = false;

jest.mock('expo-video', () => {
  const React = require('react');
  return {
    useVideoPlayer: () => mockPlayer,
    isPictureInPictureSupported: () => mockPipSupported,
    VideoView: React.forwardRef(function MockVideoView(props: Record<string, any>, ref: any) {
      React.useImperativeHandle(ref, () => mockView);
      mockViewState.props = props;
      return null;
    }),
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
  useSafeAreaInsets: () => ({ top: 59, bottom: 0, left: 0, right: 0 }),
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
    fetchVideo: jest.fn(() => Promise.resolve({ success: true, proxyHls: 'https://api.example/hls/24.m3u8' })),
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
  titlePt: 'vídeo 1',
  durationSeconds: 6925,
  posterUrl: 'https://vz.example/24/thumbnail.jpg',
} as any;

function EventScreen({ artworkUrl }: { artworkUrl?: string | null }) {
  const { openVideo } = useVideoSession();
  useEffect(() => {
    openVideo({
      video,
      eventId: '923',
      eventTitle: 'Learning to Let Go',
      videos: [video],
      teacherNames: 'Jigme Khyentse Rinpoche',
      artworkUrl,
    });
  }, [openVideo, artworkUrl]);
  return null;
}

function App({ artworkUrl = 'https://api.example/events/923/artwork.jpg' }: { artworkUrl?: string | null }) {
  return (
    <VideoSessionProvider>
      <EventScreen artworkUrl={artworkUrl} />
      <VideoHost />
    </VideoSessionProvider>
  );
}

const handlerFor = (event: string) => {
  const calls = (useEventListener as jest.Mock).mock.calls.filter(([, name]) => name === event);
  return calls[calls.length - 1][2] as (payload: any) => void;
};
const setPlaying = async (isPlaying: boolean) => {
  mockPlayer.playing = isPlaying;
  await act(async () => handlerFor('playingChange')({ isPlaying }));
};

const originalOS = Platform.OS;
const setOS = (os: string) => {
  (Platform as { OS: string }).OS = os;
};

async function openAndPlay(app: React.ReactElement = <App />) {
  const view = render(app);
  await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledTimes(1));
  await setPlaying(true);
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  mockAudioPlaying = false;
  mockPipSupported = true;
  mockViewState.props = {};
  mockPlayer.duration = 6925;
  mockPlayer.currentTime = 0;
  mockPlayer.playing = false;
  mockPlayer.showNowPlayingNotification = false;
  mockView.startPictureInPicture.mockImplementation(() => Promise.resolve());
  setOS('ios');
});
afterEach(() => {
  jest.useRealTimers();
  setOS(originalOS);
});

describe('VideoHost on iOS — leaving a playing video hands it to the system picture in picture', () => {
  it('should start the system picture in picture when the page is left while playing', async () => {
    const view = await openAndPlay();

    fireEvent.press(view.getByTestId('video-close'));

    expect(mockView.startPictureInPicture).toHaveBeenCalledTimes(1);
    // The page stays until the system has started it: AVKit needs the video on screen.
    expect(view.getByTestId('video-page')).toBeTruthy();
    expect(view.queryByTestId('video-floating')).toBeNull();
  });

  it('should hide the page and draw no floating window once the picture in picture has started', async () => {
    const view = await openAndPlay();
    fireEvent.press(view.getByTestId('video-close'));

    await act(async () => mockViewState.props.onPictureInPictureStart());

    expect(view.queryByTestId('video-page')).toBeNull();
    expect(view.queryByTestId('video-floating')).toBeNull();
    expect(view.getByTestId('video-in-system-pip')).toBeTruthy();
    const root = StyleSheet.flatten(view.getByTestId('video-player-root').props.style);
    expect(root.opacity).toBe(0);
    expect(view.getByTestId('video-player-root').props.pointerEvents).toBe('none');
    expect(mockPlayer.pause).not.toHaveBeenCalled();
  });

  it('should keep the system controls on the video while it is in picture in picture', async () => {
    const view = await openAndPlay();
    fireEvent.press(view.getByTestId('video-close'));

    await act(async () => mockViewState.props.onPictureInPictureStart());

    expect(mockViewState.props.nativeControls).toBe(true);
    expect(view.queryByTestId('video-floating-controls')).toBeNull();
  });

  it('should reopen the video page when the picture in picture returns to the app while playing', async () => {
    jest.useFakeTimers();
    const view = await openAndPlay();
    fireEvent.press(view.getByTestId('video-close'));
    await act(async () => mockViewState.props.onPictureInPictureStart());

    act(() => mockViewState.props.onPictureInPictureStop());
    act(() => jest.advanceTimersByTime(400));

    expect(view.getByTestId('video-page')).toBeTruthy();
    expect(view.queryByTestId('video-in-system-pip')).toBeNull();
    expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
  });

  it('should save the position and close the video when the picture in picture window is closed', async () => {
    jest.useFakeTimers();
    const view = await openAndPlay();
    fireEvent.press(view.getByTestId('video-close'));
    await act(async () => mockViewState.props.onPictureInPictureStart());
    mockPlayer.currentTime = 1234;

    // Closing the PiP window pauses the player.
    await setPlaying(false);
    act(() => mockViewState.props.onPictureInPictureStop());
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(mockStore.get('video-24')?.position).toBe(1234);
    expect(view.queryByTestId('video-player-root')).toBeNull();
  });

  it('should fall back to the floating window when picture in picture is not supported', async () => {
    mockPipSupported = false;
    const view = await openAndPlay();

    fireEvent.press(view.getByTestId('video-close'));

    expect(mockView.startPictureInPicture).not.toHaveBeenCalled();
    expect(view.getByTestId('video-floating')).toBeTruthy();
  });

  it('should fall back to the floating window when the system refuses to start it', async () => {
    mockView.startPictureInPicture.mockImplementation(() => Promise.reject(new Error('PiP unavailable')));
    const view = await openAndPlay();

    fireEvent.press(view.getByTestId('video-close'));
    await act(async () => undefined);

    expect(view.getByTestId('video-floating')).toBeTruthy();
  });

  it('should fall back to the floating window when the picture in picture never starts', async () => {
    jest.useFakeTimers();
    mockView.startPictureInPicture.mockImplementation(() => new Promise(() => undefined));
    const view = await openAndPlay();

    fireEvent.press(view.getByTestId('video-close'));
    act(() => jest.advanceTimersByTime(1600));

    expect(view.getByTestId('video-floating')).toBeTruthy();
  });

  it('should leave the page as it is when the system starts picture in picture on its own', async () => {
    const view = await openAndPlay();

    // The app sent to the background: AVKit starts PiP from the page by itself.
    await act(async () => mockViewState.props.onPictureInPictureStart());

    expect(view.getByTestId('video-page')).toBeTruthy();
    expect(view.queryByTestId('video-in-system-pip')).toBeNull();
  });

  it('should close a paused video instead of handing it to picture in picture', async () => {
    const view = await openAndPlay();
    await setPlaying(false);

    fireEvent.press(view.getByTestId('video-close'));

    expect(mockView.startPictureInPicture).not.toHaveBeenCalled();
    expect(view.queryByTestId('video-player-root')).toBeNull();
  });
});

describe('VideoHost on Android — the in-app floating window stays', () => {
  it('should use the floating window, not the system picture in picture', async () => {
    setOS('android');
    const view = await openAndPlay();

    fireEvent.press(view.getByTestId('video-close'));

    expect(mockView.startPictureInPicture).not.toHaveBeenCalled();
    expect(view.getByTestId('video-floating')).toBeTruthy();
  });
});
