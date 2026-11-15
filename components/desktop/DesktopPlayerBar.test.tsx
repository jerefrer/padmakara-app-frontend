import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { DesktopPlayerBar } from './DesktopPlayerBar';

jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: () => '', language: 'en' }) }));
let mockContextExtras: Record<string, unknown> = {};
jest.mock('@/contexts/AudioPlayerContext', () => ({
  useAudioPlayerContext: () => ({
    ...mockContextExtras,
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

const languageControl = { label: 'English + Portuguese', options: ['en', 'pt'], selected: ['en'], onChange: jest.fn() };

describe('DesktopPlayerBar', () => {
  beforeEach(() => {
    mockContextExtras = {};
  });

  it('should show the track title in regular weight at 18pt', () => {
    const { getByText } = render(<DesktopPlayerBar />);
    const style = StyleSheet.flatten(getByText('Some words about Tenga Rinpoche').props.style);
    expect(style.fontFamily).toBe('EBGaramond_400Regular');
    expect(style.fontWeight).toBeUndefined();
    expect(style.fontSize).toBe(18);
  });

  it('should order the right controls bookmark, speed, read along, language when the picker is offered', () => {
    mockContextExtras = { languageControl, trackBookmark: { isBookmarked: false, onToggle: jest.fn() } };
    const { toJSON } = render(<DesktopPlayerBar />);
    const order = ['audio-bookmark', 'audio-speed', 'audio-read-along', 'audio-language'];
    const ids: string[] = [];
    const walk = (node: any) => {
      if (!node || typeof node === 'string') return;
      if (order.includes(node.props?.testID)) ids.push(node.props.testID);
      (node.children ?? []).forEach(walk);
    };
    walk(toJSON());
    expect(ids).toEqual(order);
  });

  it('should not offer a transcript button, the transcript lives in the Texts tab', () => {
    mockContextExtras = { canOpenTranscript: true, openTranscript: jest.fn() };

    const { queryByLabelText } = render(<DesktopPlayerBar />);

    expect(queryByLabelText('Open transcript')).toBeNull();
  });

  it('should hide the language globe when the event offers no picker', () => {
    const { queryByTestId } = render(<DesktopPlayerBar />);
    expect(queryByTestId('audio-language')).toBeNull();
  });

  it('should open the language checkbox list with the shared options when the globe is pressed', () => {
    mockContextExtras = { languageControl };
    const { getByTestId, queryByTestId, getByLabelText } = render(<DesktopPlayerBar />);
    expect(queryByTestId('audio-language-popover')).toBeNull();
    fireEvent.press(getByTestId('audio-language'));
    expect(getByTestId('audio-language-popover')).toBeTruthy();
    expect(getByLabelText('English')).toBeTruthy();
  });

  it('should disable the bookmark control when no track bookmark is registered', () => {
    const { getByTestId } = render(<DesktopPlayerBar />);
    expect(getByTestId('audio-bookmark').props.accessibilityState?.disabled).toBe(true);
  });

  it('should toggle the track bookmark when the bookmark control is pressed', () => {
    const onToggle = jest.fn();
    mockContextExtras = { trackBookmark: { isBookmarked: false, onToggle } };
    const { getByTestId } = render(<DesktopPlayerBar />);
    fireEvent.press(getByTestId('audio-bookmark'));
    expect(onToggle).toHaveBeenCalled();
  });
});
