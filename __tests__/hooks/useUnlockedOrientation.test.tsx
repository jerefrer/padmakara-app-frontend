import { Platform } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

import { useUnlockedOrientation } from '@/hooks/useUnlockedOrientation';

jest.mock('expo-screen-orientation', () => ({
  unlockAsync: jest.fn(() => Promise.resolve()),
  lockAsync: jest.fn(() => Promise.resolve()),
  OrientationLock: { PORTRAIT_UP: 'PORTRAIT_UP' },
}));

const originalOS = Platform.OS;
// The previous test's hook is unmounted by RNTL's cleanup after the global mock reset,
// which records a lock call; start each test from clean mocks.
beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => {
  (Platform as any).OS = originalOS;
});

describe.each(['ios', 'android'])('useUnlockedOrientation on %s', (os) => {
  beforeEach(() => {
    (Platform as any).OS = os;
  });

  it('should unlock rotation when active', () => {
    renderHook(() => useUnlockedOrientation(true));
    expect(ScreenOrientation.unlockAsync).toHaveBeenCalledTimes(1);
    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
  });

  it('should do nothing while inactive', () => {
    renderHook(() => useUnlockedOrientation(false));
    expect(ScreenOrientation.unlockAsync).not.toHaveBeenCalled();
    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
  });

  it('should lock back to portrait when it becomes inactive', () => {
    const { rerender } = renderHook(({ active }: { active: boolean }) => useUnlockedOrientation(active), {
      initialProps: { active: true },
    });
    rerender({ active: false });
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith('PORTRAIT_UP');
  });

  it('should lock back to portrait when unmounted while active', () => {
    const { unmount } = renderHook(() => useUnlockedOrientation(true));
    unmount();
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith('PORTRAIT_UP');
  });
});

describe('useUnlockedOrientation on web', () => {
  it('should leave the orientation alone', () => {
    (Platform as any).OS = 'web';
    const { unmount } = renderHook(() => useUnlockedOrientation(true));
    unmount();
    expect(ScreenOrientation.unlockAsync).not.toHaveBeenCalled();
    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
  });
});
