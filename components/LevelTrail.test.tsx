import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { LevelTrail, barLayout } from './LevelTrail';
import { fadeOut, push, reset } from '@/services/audioLevel';

const heights = (utils: ReturnType<typeof render>) =>
  utils.getAllByTestId('level-trail-bar').map((b) => StyleSheet.flatten(b.props.style).height);

describe('LevelTrail', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    reset();
  });

  it('should render a still profile when no level has been pushed', () => {
    const utils = render(<LevelTrail isPlaying size={20} />);
    const before = heights(utils);
    expect(before.length).toBe(barLayout(20).count);
    expect(before.every((h) => h >= 7 && h <= 12)).toBe(true);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(heights(utils)).toEqual(before);
  });

  it.each([12, 16, 20])('should render the bar count of its layout when size is %i', (size) => {
    const utils = render(<LevelTrail isPlaying size={size} />);
    expect(utils.getAllByTestId('level-trail-bar')).toHaveLength(barLayout(size).count);
  });

  it('should make bar heights follow pushed levels, newest on the right', () => {
    const utils = render(<LevelTrail isPlaying size={20} />);
    act(() => { push(0.1); push(1); });
    const h = heights(utils);
    expect(h[h.length - 1]).toBe(20);
    expect(h[h.length - 2]).toBeCloseTo(2);
    expect(h[0]).toBe(1.5);
  });

  it('should fade older bars when levels exist', () => {
    const utils = render(<LevelTrail isPlaying size={20} />);
    act(() => { push(0.5); });
    const bars = utils.getAllByTestId('level-trail-bar');
    const opacity = (i: number) => StyleSheet.flatten(bars[i].props.style).opacity;
    expect(opacity(0)).toBeCloseTo(0.45);
    expect(opacity(bars.length - 1)).toBe(1);
  });

  it('should settle on flat minimum bars and stay there when playback stops', () => {
    const utils = render(<LevelTrail isPlaying={false} size={20} />);
    act(() => { push(1); push(0.8); fadeOut(); });
    act(() => { jest.advanceTimersByTime(400); });
    expect(heights(utils).every((h) => h === 1.5)).toBe(true);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(heights(utils).every((h) => h === 1.5)).toBe(true);
  });
});
