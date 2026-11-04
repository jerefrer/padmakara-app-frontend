import React from 'react';
import { Animated, AppState, type AppStateStatus } from 'react-native';
import { act, render } from '@testing-library/react-native';

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

  // The JS-driven loops kept the JS thread at 99% CPU with the phone locked,
  // and iOS killed the app after a couple of minutes of background audio
  // (cpu_resource_fatal, build 19). They must only run while the app is active.
  describe('app state', () => {
    let emit: (state: AppStateStatus) => void;
    let currentState: AppStateStatus;

    beforeEach(() => {
      currentState = 'active';
      Object.defineProperty(AppState, 'currentState', { get: () => currentState, configurable: true });
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
        emit = (state) => { currentState = state; (handler as (s: AppStateStatus) => void)(state); };
        return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
      });
    });

    it('should stop the loops when the app goes to the background while playing', () => {
      const stops: jest.Mock[] = [];
      const realLoop = Animated.loop;
      jest.spyOn(Animated, 'loop').mockImplementation((anim, config) => {
        const loop = realLoop(anim, config);
        const stop = jest.fn(loop.stop);
        stops.push(stop);
        return { ...loop, stop };
      });
      render(<PlayingIndicator isPlaying size={16} />);
      act(() => emit('background'));
      expect(stops).toHaveLength(5);
      stops.forEach((stop) => expect(stop).toHaveBeenCalled());
    });

    it('should not start any loop while the app is in the background', () => {
      currentState = 'background';
      const loopSpy = jest.spyOn(Animated, 'loop');
      render(<PlayingIndicator isPlaying size={16} />);
      expect(loopSpy).not.toHaveBeenCalled();
    });

    it('should restart the loops when the app comes back to the foreground', () => {
      const loopSpy = jest.spyOn(Animated, 'loop');
      render(<PlayingIndicator isPlaying size={16} />);
      act(() => emit('background'));
      loopSpy.mockClear();
      act(() => emit('active'));
      expect(loopSpy).toHaveBeenCalledTimes(5);
    });
  });
});
