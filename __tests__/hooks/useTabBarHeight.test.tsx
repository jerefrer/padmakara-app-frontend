import { Platform } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useTabBarHeight, useTabBarOverlap } from '@/hooks/useTabBarHeight';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 48, left: 0 }),
}));

describe('useTabBarOverlap', () => {
  const originalOS = Platform.OS;
  afterEach(() => { (Platform as { OS: string }).OS = originalOS; });

  it('should be the whole tab bar on iOS, where the bar floats over the screen', () => {
    (Platform as { OS: string }).OS = 'ios';
    const { result } = renderHook(() => useTabBarOverlap());
    expect(result.current).toBe(49 + 48);
  });

  it('should be zero on Android, where the screen ends above the bar', () => {
    (Platform as { OS: string }).OS = 'android';
    const { result } = renderHook(() => useTabBarOverlap());
    expect(result.current).toBe(0);
  });

  it('should be zero on the web, where the bar is not absolute either', () => {
    (Platform as { OS: string }).OS = 'web';
    const { result } = renderHook(() => useTabBarOverlap());
    expect(result.current).toBe(0);
  });

  it('should leave the full tab bar height unchanged', () => {
    (Platform as { OS: string }).OS = 'android';
    const { result } = renderHook(() => useTabBarHeight());
    expect(result.current).toBe(49 + 48);
  });
});
