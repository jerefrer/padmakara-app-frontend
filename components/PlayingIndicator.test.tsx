import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';

import { PlayingIndicator, PLAYING_INDICATOR_BAR_COUNT } from './PlayingIndicator';

describe('PlayingIndicator', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render five bars when playing', () => {
    const utils = render(<PlayingIndicator isPlaying size={20} />);
    expect(PLAYING_INDICATOR_BAR_COUNT).toBe(5);
    expect(utils.getAllByTestId('playing-indicator-bar', { includeHiddenElements: true })).toHaveLength(5);
  });

  it('should render five bars when paused', () => {
    const utils = render(<PlayingIndicator isPlaying={false} size={20} />);
    expect(utils.getAllByTestId('playing-indicator-bar', { includeHiddenElements: true })).toHaveLength(5);
  });

  it('should start one loop per bar when playing', () => {
    const loopSpy = jest.spyOn(Animated, 'loop');
    render(<PlayingIndicator isPlaying size={16} />);
    expect(loopSpy).toHaveBeenCalledTimes(5);
  });

  it('should not start any loop when paused', () => {
    const loopSpy = jest.spyOn(Animated, 'loop');
    render(<PlayingIndicator isPlaying={false} size={16} />);
    expect(loopSpy).not.toHaveBeenCalled();
  });

  it('should stop the loops when playback pauses', () => {
    const stops: jest.Mock[] = [];
    const realLoop = Animated.loop;
    jest.spyOn(Animated, 'loop').mockImplementation((anim, config) => {
      const loop = realLoop(anim, config);
      const stop = jest.fn(loop.stop);
      stops.push(stop);
      return { ...loop, stop };
    });
    const utils = render(<PlayingIndicator isPlaying size={16} />);
    utils.rerender(<PlayingIndicator isPlaying={false} size={16} />);
    expect(stops).toHaveLength(5);
    stops.forEach((stop) => expect(stop).toHaveBeenCalled());
  });
});
