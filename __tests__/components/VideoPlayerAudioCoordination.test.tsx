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

/** The handler the component registered for a native player event. */
const playingChangeHandler = () => {
  const calls = (useEventListener as jest.Mock).mock.calls.filter(([, event]) => event === 'playingChange');
  return calls[calls.length - 1][2] as (e: { isPlaying: boolean }) => void;
};

describe('VideoPlayer — audio and video never play together', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAudioPlaying = false;
  });

  it('should tell the audio context when the video starts playing', async () => {
    render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());

    act(() => playingChangeHandler()({ isPlaying: true }));

    expect(mockSetVideoPlaying).toHaveBeenLastCalledWith(true);
  });

  it('should tell the audio context when the video pauses', async () => {
    render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());
    act(() => playingChangeHandler()({ isPlaying: true }));

    act(() => playingChangeHandler()({ isPlaying: false }));

    expect(mockSetVideoPlaying).toHaveBeenLastCalledWith(false);
  });

  it('should pause the video when audio starts while the video is playing', async () => {
    const { rerender } = render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());
    act(() => playingChangeHandler()({ isPlaying: true }));
    mockPlayer.pause.mockClear();

    mockAudioPlaying = true;
    rerender(<VideoPlayer video={video} onClose={() => {}} />);

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('should not touch the video when audio starts while the video is paused', async () => {
    const { rerender } = render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());
    mockPlayer.pause.mockClear();

    mockAudioPlaying = true;
    rerender(<VideoPlayer video={video} onClose={() => {}} />);

    expect(mockPlayer.pause).not.toHaveBeenCalled();
  });

  it('should report no video playing when the video is closed', async () => {
    const { rerender } = render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());
    act(() => playingChangeHandler()({ isPlaying: true }));

    rerender(<VideoPlayer video={null} onClose={() => {}} />);

    expect(mockSetVideoPlaying).toHaveBeenLastCalledWith(false);
  });
});
