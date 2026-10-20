import {
  HISTORY_SIZE,
  createLevelMeter,
  fadeOut,
  getHistory,
  push,
  reset,
  rms,
  subscribe,
} from './audioLevel';

describe('audioLevel store', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    reset();
  });

  afterEach(() => {
    reset();
  });

  it('should append levels newest-last when pushing', () => {
    push(0.2);
    push(0.8);
    expect(getHistory()).toEqual([0.2, 0.8]);
  });

  it('should clamp levels to 0..1 when pushing out-of-range values', () => {
    push(3);
    push(-1);
    push(NaN);
    expect(getHistory()).toEqual([1, 0, 0]);
  });

  it('should keep only the newest levels when the history cap is exceeded', () => {
    for (let i = 0; i < HISTORY_SIZE + 5; i++) push(i / 100);
    const h = getHistory();
    expect(h).toHaveLength(HISTORY_SIZE);
    expect(h[h.length - 1]).toBeCloseTo((HISTORY_SIZE + 4) / 100);
  });

  it('should notify subscribers when pushing, and stop after unsubscribing', () => {
    const listener = jest.fn();
    const unsubscribe = subscribe(listener);
    push(0.5);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    push(0.5);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should return a stable reference when nothing changed', () => {
    push(0.5);
    expect(getHistory()).toBe(getHistory());
  });

  it('should decay to all zeros in about 400 ms when fading out', () => {
    push(1);
    push(0.5);
    fadeOut();
    jest.advanceTimersByTime(80);
    expect(getHistory()[1]).toBeCloseTo(0.2);
    jest.advanceTimersByTime(320);
    expect(getHistory()).toEqual([0, 0]);
  });

  it('should stop fading when a new level is pushed', () => {
    push(1);
    fadeOut();
    push(0.9);
    jest.advanceTimersByTime(1000);
    expect(getHistory()).toEqual([1, 0.9]);
  });

  it('should empty the history when reset', () => {
    push(0.5);
    reset();
    expect(getHistory()).toEqual([]);
  });
});

describe('level meter', () => {
  it('should compute the RMS of a buffer', () => {
    expect(rms([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5);
    expect(rms([])).toBe(0);
  });

  it('should push at most once per 70 ms window', () => {
    const sink = jest.fn();
    const meter = createLevelMeter(sink);
    meter.feed([0.3, -0.3], 0);
    meter.feed([0.3, -0.3], 20);
    meter.feed([0.3, -0.3], 40);
    meter.feed([0.3, -0.3], 80);
    expect(sink).toHaveBeenCalledTimes(2);
  });

  it('should reach near full scale for a steady quiet signal when gain adapts', () => {
    const sink = jest.fn();
    const meter = createLevelMeter(sink);
    for (let t = 0; t < 2000; t += 70) meter.feed([0.05, -0.05, 0.05, -0.05], t);
    const last = sink.mock.calls[sink.mock.calls.length - 1][0];
    expect(last).toBeGreaterThan(0.9);
  });

  it('should stay at zero for silence', () => {
    const sink = jest.fn();
    const meter = createLevelMeter(sink);
    for (let t = 0; t < 1000; t += 70) meter.feed([0, 0, 0, 0], t);
    expect(sink.mock.calls[sink.mock.calls.length - 1][0]).toBe(0);
  });

  it('should release more slowly than it attacks when the signal drops', () => {
    const sink = jest.fn();
    const meter = createLevelMeter(sink);
    meter.feed([0.5, -0.5], 0);
    const loud = sink.mock.calls[0][0];
    meter.feed([0, 0], 100);
    const afterQuiet = sink.mock.calls[1][0];
    expect(loud).toBeGreaterThan(0.5);
    expect(afterQuiet).toBeGreaterThan(loud * 0.5);
  });
});
