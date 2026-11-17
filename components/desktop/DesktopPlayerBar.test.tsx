import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { DesktopPlayerBar } from './DesktopPlayerBar';
import { claimTrackReveal } from '@/utils/trackReveal';

jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: () => '', language: 'en' }) }));
let mockContextExtras: Record<string, unknown> = {};
const mockOnSlidingStart = jest.fn();
const mockOnSliderValueChange = jest.fn();
const mockOnSlidingComplete = jest.fn();
jest.mock('@/contexts/AudioPlayerContext', () => ({
  useAudioPlayerContext: () => ({
    ...mockContextExtras,
    currentTrack: { id: 1, title: 'Some words about Tenga Rinpoche' },
    isPlaying: false,
    position: 25,
    duration: 100,
    onSlidingStart: mockOnSlidingStart,
    onSliderValueChange: mockOnSliderValueChange,
    onSlidingComplete: mockOnSlidingComplete,
    playbackSpeed: 1,
    groupName: 'G',
    retreatName: 'R',
    retreatId: '42',
    idleTrack: null,
  }),
}));
const mockPush = jest.fn();
let mockPathname = '/';
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  usePathname: () => mockPathname,
}));
jest.mock('@/utils/i18n', () => ({ getTrackTitle: (t: { title: string }) => t.title }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/components/PlayingIndicator', () => ({ PlayingIndicator: () => null }));

const languageControl = { label: 'English + Portuguese', options: ['en', 'pt'], selected: ['en'], onChange: jest.fn() };

describe('DesktopPlayerBar', () => {
  beforeEach(() => {
    mockContextExtras = {};
    mockPathname = '/';
    jest.clearAllMocks();
  });

  it('should open the event and ask it to show the track when the title is pressed elsewhere', () => {
    const { getByTestId } = render(<DesktopPlayerBar />);
    fireEvent.press(getByTestId('audio-track-title'));
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ params: { id: '42' } }));
    const accept = jest.fn(() => true);
    claimTrackReveal(accept);
    expect(accept).toHaveBeenCalledWith('1');
  });

  it('should only ask for the track to be shown when its event is already open', () => {
    mockPathname = '/retreat/42';
    const { getByTestId } = render(<DesktopPlayerBar />);
    fireEvent.press(getByTestId('audio-track-title'));
    expect(mockPush).not.toHaveBeenCalled();
    const accept = jest.fn(() => true);
    claimTrackReveal(accept);
    expect(accept).toHaveBeenCalledWith('1');
  });

  it('should draw the play control as a bare icon without the red disc', () => {
    const { getByTestId } = render(<DesktopPlayerBar />);
    const style = StyleSheet.flatten(getByTestId('audio-play-pause').props.style);
    expect(style.backgroundColor).toBeUndefined();
  });

  it('should show the elapsed time left of the controls and the time left right of them', () => {
    const { getByTestId } = render(<DesktopPlayerBar />);
    expect(getByTestId('audio-current-time').props.children).toBe('0:25');
    expect(getByTestId('audio-remaining-time').props.children).toBe('- 1:15');
  });

  it('should fill the top progress line in proportion to the position', () => {
    const { getByTestId } = render(<DesktopPlayerBar />);
    expect(StyleSheet.flatten(getByTestId('audio-progress-fill').props.style).width).toBe('25%');
  });

  it('should expose the progress line as an adjustable control with its value', () => {
    const { getByTestId } = render(<DesktopPlayerBar />);
    const seek = getByTestId('audio-seek');
    expect(seek.props.accessibilityRole).toBe('adjustable');
    expect(seek.props['aria-valuemin']).toBe(0);
    expect(seek.props['aria-valuemax']).toBe(100);
    expect(seek.props['aria-valuenow']).toBe(25);
  });

  it('should seek to the clicked point of the progress line', () => {
    const { getByTestId } = render(<DesktopPlayerBar />);
    const seek = getByTestId('audio-seek');
    fireEvent(seek, 'layout', { nativeEvent: { layout: { width: 1000, height: 16, x: 0, y: 0 } } });
    const at = (pageX: number) => ({ nativeEvent: { pageX, locationX: pageX - 100 } });

    fireEvent(seek, 'responderGrant', at(400));
    fireEvent(seek, 'responderMove', at(700));
    fireEvent(seek, 'responderRelease', at(700));

    expect(mockOnSlidingStart).toHaveBeenCalled();
    expect(mockOnSliderValueChange).toHaveBeenLastCalledWith(60);
    expect(mockOnSlidingComplete).toHaveBeenCalledWith(60);
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
