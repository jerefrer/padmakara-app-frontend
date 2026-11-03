import React from 'react';
import { Platform } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { AudioPlayer } from '@/components/AudioPlayer';

const mockOnSliderValueChange = jest.fn();
const mockOnSlidingComplete = jest.fn();

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
    onSlidingComplete: mockOnSlidingComplete,
    onSliderValueChange: mockOnSliderValueChange,
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

  it('should draw its own bar on Android', () => {
    (Platform as { OS: string }).OS = 'android';
    const { getByTestId } = render(<AudioPlayer />);
    expect(getByTestId('audio-progress-fill')).toBeTruthy();
  });

  it('should keep the native slider bar on iOS', () => {
    (Platform as { OS: string }).OS = 'ios';
    const { queryByTestId } = render(<AudioPlayer />);
    expect(queryByTestId('audio-progress-track')).toBeNull();
  });
});

describe('AudioPlayer Android scrubbing', () => {
  const originalOS = Platform.OS;
  afterEach(() => { (Platform as { OS: string }).OS = originalOS; });

  beforeEach(() => {
    mockOnSliderValueChange.mockClear();
    mockOnSlidingComplete.mockClear();
  });

  it('should hand the released position to the audio context before seeking, so the old time does not flash back', () => {
    (Platform as { OS: string }).OS = 'android';
    const { UNSAFE_getByProps } = render(<AudioPlayer />);
    const slider = UNSAFE_getByProps({ testID: 'audio-seek' });
    act(() => {
      slider.props.onSlidingStart();
      slider.props.onValueChange(20);
      slider.props.onSlidingComplete(20);
    });
    expect(mockOnSliderValueChange).toHaveBeenCalledWith(20);
    expect(mockOnSliderValueChange.mock.invocationCallOrder[0]).toBeLessThan(
      mockOnSlidingComplete.mock.invocationCallOrder[0],
    );
  });

  it('should show the finger position in the time label while scrubbing', () => {
    (Platform as { OS: string }).OS = 'android';
    const { getByTestId, UNSAFE_getByProps } = render(<AudioPlayer />);
    const slider = UNSAFE_getByProps({ testID: 'audio-seek' });
    act(() => {
      slider.props.onSlidingStart();
      slider.props.onValueChange(90);
    });
    expect(getByTestId('audio-current-time').props.children).toBe('1:30');
  });

  it('should keep the audio context out of the scrub, so the event screen does not re-render', () => {
    (Platform as { OS: string }).OS = 'android';
    const { UNSAFE_getByProps } = render(<AudioPlayer />);
    const slider = UNSAFE_getByProps({ testID: 'audio-seek' });
    act(() => {
      slider.props.onSlidingStart();
      for (const v of [40, 41, 42, 43, 44]) slider.props.onValueChange(v);
    });
    expect(mockOnSliderValueChange).not.toHaveBeenCalled();
  });
});
