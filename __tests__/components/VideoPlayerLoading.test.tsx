import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import { VideoPlayer } from '@/components/VideoPlayer';
import { useEventListener } from 'expo';

const mockPlayer: Record<string, any> = {
  subtitleTrack: undefined,
  replace: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  currentTime: 0,
  duration: 0,
};
const mockSetVideoPlaying = jest.fn();
let mockAudioPlaying = false;

jest.mock('expo-video', () => ({
  useVideoPlayer: () => mockPlayer,
  VideoView: () => null,
}));
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
jest.mock('@/components/WebHlsVideo', () => ({ WebHlsVideo: () => null }));
jest.mock('@/services/retreatService', () => ({
  __esModule: true,
  default: {
    fetchVideo: jest.fn(() => Promise.resolve({ success: true, proxyHls: 'https://api.example/hls/7.m3u8' })),
  },
}));
jest.mock('@/services/progressService', () => ({
  __esModule: true,
  default: {
    getProgress: jest.fn(() => Promise.resolve(null)),
    getVideoProgressRemote: jest.fn(() => Promise.resolve(null)),
    saveProgress: jest.fn(() => Promise.resolve()),
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

const video = { id: 7, title: 'Shantideva', durationSeconds: 600 } as any;

const handlerFor = (event: string) => {
  const calls = (useEventListener as jest.Mock).mock.calls.filter(([, name]) => name === event);
  return calls[calls.length - 1][2] as (payload: any) => void;
};

// What ExoPlayer reports as the duration until it has loaded the source.
const DURATION_UNSET = -9223372474941440;

describe('VideoPlayer — while the source loads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayer.duration = 0;
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });
  afterEach(() => jest.restoreAllMocks());

  const open = async (onComplete = jest.fn()) => {
    const screen = render(<VideoPlayer video={video} onClose={() => {}} onComplete={onComplete} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());
    return { screen, onComplete };
  };

  it('should not treat an unknown duration as the end of the video', async () => {
    const { onComplete } = await open();
    mockPlayer.duration = DURATION_UNSET;
    act(() => handlerFor('timeUpdate')({ currentTime: 343 }));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('should still complete at the end of a video of known length', async () => {
    const { onComplete } = await open();
    mockPlayer.duration = 600;
    act(() => handlerFor('timeUpdate')({ currentTime: 599 }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should show the loader until the player is ready', async () => {
    const { screen } = await open();
    expect(screen.queryByTestId('video-buffering')).toBeTruthy();
    act(() => handlerFor('statusChange')({ status: 'readyToPlay' }));
    expect(screen.queryByTestId('video-buffering')).toBeNull();
  });

  it('should say a video not uploaded yet will come soon, without an error', async () => {
    const retreatService = jest.requireMock('@/services/retreatService').default;
    retreatService.fetchVideo.mockResolvedValueOnce({ success: false, notReady: true, error: 'Video is still being processed' });

    const screen = render(<VideoPlayer video={video} onClose={() => {}} />);

    await waitFor(() => expect(screen.queryByTestId('video-not-ready')).toBeTruthy());
    expect(screen.queryByText('video.notReady')).toBeTruthy();
    expect(screen.queryByText('Video is still being processed')).toBeNull();
  });
});

