import React from 'react';
import { Alert } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { VideoPlayer } from '@/components/VideoPlayer';
import videoPreferencesService from '@/services/videoPreferencesService';

const mockPlayer: Record<string, any> = {
  subtitleTrack: undefined,
  replace: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  currentTime: 0,
  duration: 0,
};
const mockStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((k: string) => Promise.resolve(k in mockStore ? mockStore[k] : null)),
    setItem: jest.fn((k: string, v: string) => {
      mockStore[k] = v;
      return Promise.resolve();
    }),
  },
}));
jest.mock('expo-video', () => ({ useVideoPlayer: () => mockPlayer, VideoView: () => null }));
jest.mock('@/modules/device-rotation', () => ({ subscribeToDeviceRotation: () => () => undefined }));
jest.mock('expo', () => ({ useEventListener: jest.fn() }));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(() => Promise.resolve({ type: 'CELLULAR' })),
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
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
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
  default: { getLocalUri: jest.fn(() => Promise.resolve(null)), download: jest.fn(), delete: jest.fn() },
}));

const video = { id: 7, title: 'Shantideva', durationSeconds: 600 } as any;

describe('VideoPlayer — mobile data prompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  });

  const pressInPrompt = (label: string) => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === label)?.onPress?.();
    });
  };

  it('should offer Cancel, Don\'t show again and Continue in that order', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'cancel')?.onPress?.();
    });
    render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const labels = (spy.mock.calls[0][2] ?? []).map((b) => b.text);
    expect(labels).toEqual(['common.cancel', 'video.cellularWarningDontShowAgain', 'video.cellularWarningContinue']);
  });

  it('should play the video and turn the warning off when choosing Don\'t show again', async () => {
    pressInPrompt('video.cellularWarningDontShowAgain');
    const seen: boolean[] = [];
    const unsubscribe = videoPreferencesService.subscribeWarnOnCellular((v) => seen.push(v));

    render(<VideoPlayer video={video} onClose={() => {}} />);

    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());
    expect(await videoPreferencesService.getWarnOnCellular()).toBe(false);
    expect(seen).toEqual([false]); // the Settings switch is told at once
    unsubscribe();
  });

  it('should not prompt again on a later video once Don\'t show again was chosen', async () => {
    pressInPrompt('video.cellularWarningDontShowAgain');
    render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());

    const alertSpy = jest.spyOn(Alert, 'alert').mockClear();
    mockPlayer.replace.mockClear();
    render(<VideoPlayer video={{ ...video, id: 8 }} onClose={() => {}} />);

    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('should keep the warning on when choosing Continue', async () => {
    pressInPrompt('video.cellularWarningContinue');
    render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());
    expect(await videoPreferencesService.getWarnOnCellular()).toBe(true);
  });

  it('should close without playing or changing the setting when choosing Cancel', async () => {
    pressInPrompt('common.cancel');
    const onClose = jest.fn();
    render(<VideoPlayer video={video} onClose={onClose} />);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockPlayer.replace).not.toHaveBeenCalled();
    expect(await videoPreferencesService.getWarnOnCellular()).toBe(true);
  });
});
