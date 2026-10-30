import { renderHook } from '@testing-library/react-native';

import { useSecretTaps } from '@/hooks/useSecretTaps';

let now = 0;

beforeEach(() => {
  now = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});

function tapTimes(tap: () => void, times: number, gapMs = 200) {
  for (let i = 0; i < times; i++) {
    now += gapMs;
    tap();
  }
}

describe('useSecretTaps', () => {
  it('should unlock on the seventh quick tap', () => {
    const onUnlock = jest.fn();
    const { result } = renderHook(() => useSecretTaps(7, onUnlock));

    tapTimes(result.current, 6);
    expect(onUnlock).not.toHaveBeenCalled();

    tapTimes(result.current, 1);
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('should start counting again when the taps are too far apart', () => {
    const onUnlock = jest.fn();
    const { result } = renderHook(() => useSecretTaps(7, onUnlock));

    tapTimes(result.current, 6);
    tapTimes(result.current, 1, 2000);

    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('should need a full new series of taps after unlocking', () => {
    const onUnlock = jest.fn();
    const { result } = renderHook(() => useSecretTaps(7, onUnlock));

    tapTimes(result.current, 13);

    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});
