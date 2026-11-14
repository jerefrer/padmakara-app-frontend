import { act, renderHook } from '@testing-library/react-native';

import { useReaderBars } from '@/hooks/useReaderBars';
import { useReaderImmersive } from '@/utils/readerImmersive';

describe('useReaderBars', () => {
  it('should start with the bars shown', () => {
    const { result } = renderHook(() => useReaderBars(true));
    expect(result.current.barsHidden).toBe(false);
  });

  it('should hide and show the bars on each toggle and tell the tab bar', () => {
    const { result } = renderHook(() => ({ bars: useReaderBars(true), immersive: useReaderImmersive() }));

    act(() => result.current.bars.toggleBars());
    expect(result.current.bars.barsHidden).toBe(true);
    expect(result.current.immersive).toBe(true);

    act(() => result.current.bars.toggleBars());
    expect(result.current.bars.barsHidden).toBe(false);
    expect(result.current.immersive).toBe(false);
  });

  it('should show the bars again when the reader closes', () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => ({ bars: useReaderBars(active), immersive: useReaderImmersive() }),
      { initialProps: { active: true } }
    );
    act(() => result.current.bars.toggleBars());

    rerender({ active: false });

    expect(result.current.bars.barsHidden).toBe(false);
    expect(result.current.immersive).toBe(false);
  });

  it('should give the tab bar back when the screen unmounts with the bars hidden', () => {
    const reader = renderHook(() => useReaderBars(true));
    const tabs = renderHook(() => useReaderImmersive());
    act(() => reader.result.current.toggleBars());
    expect(tabs.result.current).toBe(true);

    act(() => reader.unmount());

    expect(tabs.result.current).toBe(false);
  });

  it('should ignore toggles while inactive', () => {
    const { result } = renderHook(() => useReaderBars(false));
    act(() => result.current.toggleBars());
    expect(result.current.barsHidden).toBe(false);
  });
});
