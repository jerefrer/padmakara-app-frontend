import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { DesktopPlayerBar } from './DesktopPlayerBar';

jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: () => '', language: 'en' }) }));
jest.mock('@/contexts/AudioPlayerContext', () => ({
  useAudioPlayerContext: () => ({
    currentTrack: { id: 1, title: 'Some words about Tenga Rinpoche' },
    isPlaying: false,
    position: 0,
    duration: 100,
    playbackSpeed: 1,
    groupName: 'G',
    retreatName: 'R',
    idleTrack: null,
  }),
}));
jest.mock('@/utils/i18n', () => ({ getTrackTitle: (t: { title: string }) => t.title }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-community/slider', () => () => null);
jest.mock('@/components/PlayingIndicator', () => ({ PlayingIndicator: () => null }));

describe('DesktopPlayerBar', () => {
  it('should show the track title in regular weight at 18pt', () => {
    const { getByText } = render(<DesktopPlayerBar />);
    const style = StyleSheet.flatten(getByText('Some words about Tenga Rinpoche').props.style);
    expect(style.fontFamily).toBe('EBGaramond_400Regular');
    expect(style.fontWeight).toBeUndefined();
    expect(style.fontSize).toBe(18);
  });
});
