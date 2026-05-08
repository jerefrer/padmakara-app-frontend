import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ─── Mocks ──────────────────────────────────────────────────────────

const mockTogglePlayPause = jest.fn();
const mockClearTrack = jest.fn();
const mockPush = jest.fn();
let mockUseSegmentsReturn: string[] = [];
let mockAudioContext: any = null;

jest.mock('@/contexts/AudioPlayerContext', () => ({
  useAudioPlayerContext: () => mockAudioContext,
}));

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('expo-router', () => ({
  useSegments: () => mockUseSegmentsReturn,
  router: {
    push: (...args: any[]) => mockPush(...args),
  },
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 49,
}));

// ─── Helpers ────────────────────────────────────────────────────────

const baseContext = {
  currentTrack: { id: 't1', title: 'Track 1' },
  isPlaying: true,
  retreatId: '42',
  retreatName: 'Spring 2026',
  groupName: 'Lisboa',
  togglePlayPause: mockTogglePlayPause,
  clearTrack: mockClearTrack,
};

const renderMiniPlayer = () => {
  const { MiniPlayer } = require('@/components/MiniPlayer');
  return render(<MiniPlayer />);
};

beforeEach(() => {
  mockTogglePlayPause.mockReset();
  mockClearTrack.mockReset();
  mockPush.mockReset();
  mockUseSegmentsReturn = ['(tabs)', 'bookmarks'];
  mockAudioContext = { ...baseContext };
});

// ─── Tests ──────────────────────────────────────────────────────────

describe('MiniPlayer — visibility', () => {
  it('renders nothing when there is no current track', () => {
    mockAudioContext = { ...baseContext, currentTrack: null };
    const { queryByLabelText } = renderMiniPlayer();
    expect(queryByLabelText('miniPlayer.openSession')).toBeNull();
  });

  it('renders nothing when on the owning event screen', () => {
    mockUseSegmentsReturn = ['(tabs)', '(groups)', 'retreat', '42'];
    mockAudioContext = { ...baseContext, retreatId: '42' };
    const { queryByLabelText } = renderMiniPlayer();
    expect(queryByLabelText('miniPlayer.openSession')).toBeNull();
  });

  it('renders when on a different event screen', () => {
    mockUseSegmentsReturn = ['(tabs)', '(groups)', 'retreat', '99'];
    mockAudioContext = { ...baseContext, retreatId: '42' };
    const { getByLabelText } = renderMiniPlayer();
    expect(getByLabelText('miniPlayer.openSession')).toBeTruthy();
  });

  it('renders on a non-retreat tab', () => {
    mockUseSegmentsReturn = ['(tabs)', 'settings'];
    const { getByLabelText } = renderMiniPlayer();
    expect(getByLabelText('miniPlayer.openSession')).toBeTruthy();
  });

  it('renders when paused (currentTrack present, isPlaying false)', () => {
    mockAudioContext = { ...baseContext, isPlaying: false };
    const { getByLabelText } = renderMiniPlayer();
    expect(getByLabelText('miniPlayer.openSession')).toBeTruthy();
  });
});

describe('MiniPlayer — content', () => {
  it('displays the track title and group · retreat subtitle', () => {
    const { getByText } = renderMiniPlayer();
    expect(getByText('Track 1')).toBeTruthy();
    expect(getByText('Lisboa · Spring 2026')).toBeTruthy();
  });

  it('omits the subtitle separator when only one of group/retreat is present', () => {
    mockAudioContext = { ...baseContext, groupName: null };
    const { getByText, queryByText } = renderMiniPlayer();
    expect(getByText('Spring 2026')).toBeTruthy();
    expect(queryByText('Lisboa · Spring 2026')).toBeNull();
  });
});

describe('MiniPlayer — interactions', () => {
  it('pressing play/pause calls togglePlayPause', () => {
    const { getByLabelText } = renderMiniPlayer();
    fireEvent.press(getByLabelText('miniPlayer.pause'));
    expect(mockTogglePlayPause).toHaveBeenCalledTimes(1);
  });

  it('shows a play label when paused and calls togglePlayPause when pressed', () => {
    mockAudioContext = { ...baseContext, isPlaying: false };
    const { getByLabelText } = renderMiniPlayer();
    fireEvent.press(getByLabelText('miniPlayer.play'));
    expect(mockTogglePlayPause).toHaveBeenCalledTimes(1);
  });

  it('pressing close calls clearTrack', () => {
    const { getByLabelText } = renderMiniPlayer();
    fireEvent.press(getByLabelText('miniPlayer.close'));
    expect(mockClearTrack).toHaveBeenCalledTimes(1);
  });

  it('pressing the surface navigates to the owning event', () => {
    const { getByLabelText } = renderMiniPlayer();
    fireEvent.press(getByLabelText('miniPlayer.openSession'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    const arg = mockPush.mock.calls[0][0];
    // Accept either object form or string form; check id is "42".
    if (typeof arg === 'string') {
      expect(arg).toContain('42');
    } else {
      expect(arg.params.id).toBe('42');
    }
  });

  it('does not navigate when retreatId is missing', () => {
    mockAudioContext = { ...baseContext, retreatId: null };
    const { getByLabelText } = renderMiniPlayer();
    fireEvent.press(getByLabelText('miniPlayer.openSession'));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
