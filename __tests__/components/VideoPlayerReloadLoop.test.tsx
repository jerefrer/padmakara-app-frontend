import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { VideoPlayer } from '@/components/VideoPlayer';
import retreatService from '@/services/retreatService';
import videoPreferencesService from '@/services/videoPreferencesService';
import { useEventListener } from 'expo';

const mockPlayer: Record<string, any> = {
  subtitleTrack: undefined,
  replace: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  currentTime: 0,
  duration: 0,
};

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
// A fresh translator on every call, as LanguageProvider hands out on every
// render of its own: the player must not treat that as a new video.
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
jest.mock('@/contexts/AudioPlayerContext', () => ({
  useAudioPlayerContext: () => ({ isPlaying: false, setVideoPlaying: jest.fn() }),
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
  default: {
    getLocalUri: jest.fn(() => Promise.resolve(null)),
    download: jest.fn(),
    delete: jest.fn(),
  },
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

describe('VideoPlayer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should load the video once when the parent re-renders with a new onClose', async () => {
    // Arrange: the event screen passes an inline onClose and re-renders on
    // every tick of whatever else is playing.
    const { rerender } = render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledTimes(1));

    // Act
    for (let i = 0; i < 3; i++) {
      rerender(<VideoPlayer video={video} onClose={() => {}} />);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    expect(retreatService.fetchVideo).toHaveBeenCalledTimes(1);
    expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
  });

  it('should load the new video when the video itself changes', async () => {
    const { rerender } = render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledTimes(1));

    rerender(<VideoPlayer video={{ ...video, id: 8 }} onClose={() => {}} />);

    await waitFor(() => expect(retreatService.fetchVideo).toHaveBeenCalledTimes(2));
    expect(retreatService.fetchVideo).toHaveBeenLastCalledWith(8);
  });

  describe('initial subtitle track', () => {
    const tracks = [
      { language: 'en', label: 'English' },
      { language: 'pt', label: 'Português' },
      { language: 'fr', label: 'Français' },
    ];

    /** Render, wait for the stored choice, then deliver the parsed tracks like the native player does. */
    const startWithStoredChoice = async (stored: string | null) => {
      (videoPreferencesService.getSubtitleLanguage as jest.Mock).mockResolvedValueOnce(stored);
      mockPlayer.subtitleTrack = undefined;
      render(<VideoPlayer video={video} onClose={() => {}} />);
      await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledTimes(1));
      const calls = (useEventListener as jest.Mock).mock.calls.filter(
        ([, event]) => event === 'availableSubtitleTracksChange',
      );
      calls[calls.length - 1][2]({ availableSubtitleTracks: tracks });
    };

    it('should start with the interface language when the viewer never chose', async () => {
      await startWithStoredChoice(null);
      expect(mockPlayer.subtitleTrack).toBe(tracks[0]);
    });

    it('should start with the language chosen in Settings', async () => {
      await startWithStoredChoice('fr');
      expect(mockPlayer.subtitleTrack).toBe(tracks[2]);
    });

    it('should start without subtitles when Settings says not to show them', async () => {
      await startWithStoredChoice('off');
      expect(mockPlayer.subtitleTrack).toBeNull();
    });
  });
});
