import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { AudioPlayer } from '@/components/AudioPlayer';

jest.mock('@/contexts/AudioPlayerContext', () => ({
  SKIP_INTERVAL_S: 15,
  useAudioPlayerContext: () => ({
    currentTrack: { id: 't1', title: 'Track 1' },
    isPlaying: false,
    isLoading: false,
    position: 30,
    duration: 120,
    playbackRate: 1,
    togglePlayPause: jest.fn(),
    skipForward: jest.fn(),
    skipBackward: jest.fn(),
    nextTrack: jest.fn(),
    previousTrack: jest.fn(),
    hasNextTrack: true,
    hasPreviousTrack: true,
    changePlaybackSpeed: jest.fn(),
    onSlidingStart: jest.fn(),
    onSlidingComplete: jest.fn(),
    onSliderValueChange: jest.fn(),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => '', language: 'en' }),
}));

describe('AudioPlayer progress and skip labels', () => {
  const originalOS = Platform.OS;
  afterEach(() => { (Platform as { OS: string }).OS = originalOS; });

  it('should label both skip buttons with the real skip interval', () => {
    const { getAllByText } = render(<AudioPlayer />);
    expect(getAllByText('15')).toHaveLength(2);
  });

  it('should draw its own edge-to-edge bar filled to the position on Android', () => {
    (Platform as { OS: string }).OS = 'android';
    const { getByTestId } = render(<AudioPlayer />);
    expect(StyleSheet.flatten(getByTestId('audio-progress-fill').props.style).width).toBe('25%');
  });

  it('should keep the native slider bar on iOS', () => {
    (Platform as { OS: string }).OS = 'ios';
    const { queryByTestId } = render(<AudioPlayer />);
    expect(queryByTestId('audio-progress-track')).toBeNull();
  });
});
