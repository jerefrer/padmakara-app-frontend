import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { MiniPlayer } from '@/components/MiniPlayer';
import { NowPlayingBadge } from '@/components/NowPlayingBadge';

let mockAudio: Record<string, unknown>;

jest.mock('@/contexts/AudioPlayerContext', () => ({ useAudioPlayerContext: () => mockAudio }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => (key === 'player.nowPlaying' ? 'Now Playing' : key), language: 'en' }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, usePathname: () => '/' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

function audio(overrides: Record<string, unknown> = {}) {
  return {
    currentTrack: { id: '1', title: 'Verse 78' },
    isPlaying: true,
    retreatId: '920',
    retreatName: 'Shantideva',
    groupName: null,
    togglePlayPause: jest.fn(),
    clearTrack: jest.fn(),
    ...overrides,
  };
}

describe('MiniPlayer', () => {
  it('should show moving bars while a teaching plays', () => {
    // Ana Paula: browsing elsewhere, it was not clear something still played.
    mockAudio = audio();
    render(<MiniPlayer />);
    expect(screen.getByTestId('miniplayer-playing')).toBeTruthy();
  });

  it('should show the still note when the teaching is paused', () => {
    mockAudio = audio({ isPlaying: false });
    render(<MiniPlayer />);
    expect(screen.queryByTestId('miniplayer-playing')).toBeNull();
  });
});

describe('NowPlayingBadge', () => {
  it('should mark the card of the event that is playing', () => {
    mockAudio = audio();
    render(<NowPlayingBadge eventId={920} />);
    expect(screen.getByText('Now Playing')).toBeTruthy();
  });

  it('should not mark the card of another event', () => {
    mockAudio = audio();
    render(<NowPlayingBadge eventId={921} />);
    expect(screen.queryByText('Now Playing')).toBeNull();
  });

  it('should not mark anything while playback is paused', () => {
    mockAudio = audio({ isPlaying: false });
    render(<NowPlayingBadge eventId={920} />);
    expect(screen.queryByText('Now Playing')).toBeNull();
  });
});
