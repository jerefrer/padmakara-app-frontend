import { act, renderHook } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';

import { useReaderBars } from '@/hooks/useReaderBars';
import { useReaderImmersive } from '@/utils/readerImmersive';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));

const PORTRAIT = { width: 390, height: 844, scale: 3, fontScale: 1 };
const LANDSCAPE = { width: 844, height: 390, scale: 3, fontScale: 1 };
const TABLET_LANDSCAPE = { width: 1180, height: 820, scale: 2, fontScale: 1 };
const setWindow = (size: typeof PORTRAIT) => (useWindowDimensions as jest.Mock).mockReturnValue(size);

beforeEach(() => setWindow(PORTRAIT));

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

  it('should hide the bars when a phone turns sideways and bring them back upright', () => {
    const { result, rerender } = renderHook(() => ({ bars: useReaderBars(true), immersive: useReaderImmersive() }));

    setWindow(LANDSCAPE);
    rerender({});
    expect(result.current.bars.barsHidden).toBe(true);
    expect(result.current.immersive).toBe(true);

    setWindow(PORTRAIT);
    rerender({});
    expect(result.current.bars.barsHidden).toBe(false);
  });

  it('should let a tap show the bars while sideways', () => {
    setWindow(LANDSCAPE);
    const { result } = renderHook(() => useReaderBars(true));
    expect(result.current.barsHidden).toBe(true);

    act(() => result.current.toggleBars());

    expect(result.current.barsHidden).toBe(false);
  });

  it('should keep the bars on a tablet in landscape', () => {
    setWindow(TABLET_LANDSCAPE);
    const { result } = renderHook(() => useReaderBars(true));
    expect(result.current.barsHidden).toBe(false);
  });

  it('should not clear the tab bar for another open reader when the phone turns', () => {
    const { result, rerender } = renderHook(() => ({
      open: useReaderBars(true),
      closed: useReaderBars(false),
      immersive: useReaderImmersive(),
    }));

    setWindow(LANDSCAPE);
    rerender({});

    expect(result.current.immersive).toBe(true);
  });
});
