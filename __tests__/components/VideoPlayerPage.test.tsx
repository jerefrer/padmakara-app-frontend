import React from 'react';
import * as ReactNative from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { VideoPlayer } from '@/components/VideoPlayer';

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

let mockOnRotation: ((rotation: string) => void) | null = null;
const mockUnsubscribe = jest.fn();
jest.mock('@/modules/device-rotation', () => ({
  subscribeToDeviceRotation: (listener: (rotation: string) => void) => {
    mockOnRotation = listener;
    return mockUnsubscribe;
  },
}));
const mockEnterFullscreen = jest.fn();
jest.mock('expo-video', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  return {
    useVideoPlayer: () => mockPlayer,
    VideoView: forwardRef((_props: unknown, ref: unknown) => {
      useImperativeHandle(ref, () => ({ enterFullscreen: mockEnterFullscreen }));
      return null;
    }),
  };
});
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
  useSafeAreaInsets: () => ({ top: 0, bottom: 48, left: 0, right: 0 }),
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

const video = { id: 7, titleEn: 'Part one', durationSeconds: 600 } as any;
const other = { id: 8, titleEn: 'Part two', durationSeconds: 300 } as any;

describe('VideoPlayer — the video page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rotate(390, 844);
  });
  afterEach(() => jest.restoreAllMocks());

  const open = async (extra: Record<string, unknown> = {}) => {
    const screen = render(<VideoPlayer video={video} onClose={() => {}} {...extra} />);
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalled());
    return screen;
  };

  const rotate = (width: number, height: number) =>
    act(() => {
      const size = { width, height, scale: 1, fontScale: 1 };
      ReactNative.Dimensions.set({ window: size, screen: size });
    });

  it('should offer the bookmark and offline actions on the page', async () => {
    rotate(390, 844);
    const screen = await open();
    expect(screen.getByTestId('video-bookmark-add')).toBeTruthy();
    expect(screen.getByTestId('video-save-offline')).toBeTruthy();
  });

  it('should keep the page clear of the navigation bar', async () => {
    rotate(390, 844);
    const screen = await open();
    const style = ReactNative.StyleSheet.flatten(screen.getByTestId('video-page').props.contentContainerStyle);
    expect(style.paddingBottom).toBeGreaterThanOrEqual(48);
  });

  it('should list the other videos of the event and switch to the one pressed', async () => {
    rotate(390, 844);
    const onSelectVideo = jest.fn();
    const screen = await open({ videos: [video, other], onSelectVideo });
    expect(screen.queryByTestId('video-other-7')).toBeNull();
    fireEvent.press(screen.getByTestId('video-other-8'));
    expect(onSelectVideo).toHaveBeenCalledWith(other);
  });

  it('should put the close button on a white bar above the video, not over it', async () => {
    const onClose = jest.fn();
    const screen = await open({ onClose });
    const bar = screen.getByTestId('video-close-bar');
    expect(ReactNative.StyleSheet.flatten(bar.props.style).backgroundColor).toBe('#ffffff');
    expect(ReactNative.StyleSheet.flatten(bar.props.style).height).toBeGreaterThanOrEqual(44);
    const button = screen.getByTestId('video-close');
    expect(button.props.accessibilityLabel).toBe('common.close');
    expect(ReactNative.StyleSheet.flatten(button.props.style).position).not.toBe('absolute');
    fireEvent.press(button);
    expect(onClose).toHaveBeenCalled();
  });

  it('should drop the white bar when a phone is rotated to full screen', async () => {
    const screen = await open();
    rotate(844, 390);
    await waitFor(() => expect(screen.queryByTestId('video-close-bar')).toBeNull());
    expect(screen.getByTestId('video-close')).toBeTruthy();
  });

  it('should keep the close button over the video on the web', async () => {
    const originalOS = ReactNative.Platform.OS;
    ReactNative.Platform.OS = 'web';
    try {
      const screen = render(<VideoPlayer video={video} onClose={() => {}} />);
      await waitFor(() => expect(screen.getByTestId('video-close')).toBeTruthy());
      expect(screen.queryByTestId('video-close-bar')).toBeNull();
    } finally {
      ReactNative.Platform.OS = originalOS;
    }
  });

  it('should go full screen when a phone is rotated', async () => {
    rotate(390, 844);
    const screen = await open();
    expect(mockEnterFullscreen).not.toHaveBeenCalled();
    rotate(844, 390);
    await waitFor(() => expect(mockEnterFullscreen).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('video-page')).toBeNull();
  });

  it('should go full screen once the video is ready when rotated while it loads', async () => {
    rotate(844, 390);
    render(<VideoPlayer video={video} onClose={() => {}} />);
    await waitFor(() => expect(mockEnterFullscreen).toHaveBeenCalledTimes(1));
  });

  describe('on an Android phone', () => {
    const originalOS = ReactNative.Platform.OS;
    const ScreenOrientation = require('expo-screen-orientation');
    beforeEach(() => {
      ReactNative.Platform.OS = 'android';
      mockOnRotation = null;
    });
    afterEach(() => {
      ReactNative.Platform.OS = originalOS;
    });

    it('should keep the screen in portrait and open full screen from the way the phone is held', async () => {
      const screen = await open();
      expect(ScreenOrientation.unlockAsync).not.toHaveBeenCalled();
      await waitFor(() => expect(mockOnRotation).not.toBeNull());
      act(() => mockOnRotation!('landscape'));
      expect(mockEnterFullscreen).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('video-page')).toBeTruthy();
    });

    it('should wait for the phone to return to portrait before opening full screen again', async () => {
      await open();
      await waitFor(() => expect(mockOnRotation).not.toBeNull());
      act(() => mockOnRotation!('landscape'));
      act(() => mockOnRotation!('landscape'));
      expect(mockEnterFullscreen).toHaveBeenCalledTimes(1);
      act(() => mockOnRotation!('portrait'));
      act(() => mockOnRotation!('landscape'));
      expect(mockEnterFullscreen).toHaveBeenCalledTimes(2);
    });

    it('should stop listening when the player closes', async () => {
      const screen = await open();
      await waitFor(() => expect(mockOnRotation).not.toBeNull());
      screen.rerender(<VideoPlayer video={null} onClose={() => {}} />);
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('on an Android tablet', () => {
    it('should rotate freely and keep the page', async () => {
      const originalOS = ReactNative.Platform.OS;
      ReactNative.Platform.OS = 'android';
      rotate(800, 1200);
      mockOnRotation = null;
      const ScreenOrientation = require('expo-screen-orientation');
      await open();
      await waitFor(() => expect(ScreenOrientation.unlockAsync).toHaveBeenCalled());
      expect(mockOnRotation).toBeNull();
      ReactNative.Platform.OS = originalOS;
    });
  });

  it('should keep the page on a rotated tablet', async () => {
    rotate(800, 1200);
    const screen = await open();
    rotate(1200, 800);
    expect(mockEnterFullscreen).not.toHaveBeenCalled();
    expect(screen.getByTestId('video-page')).toBeTruthy();
  });
});
