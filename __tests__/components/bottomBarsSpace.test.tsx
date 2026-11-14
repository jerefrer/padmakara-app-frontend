import { renderHook } from '@testing-library/react-native';

import { useBottomBarsSpace } from '@/components/MiniPlayer';

let mockPlayer = { currentTrack: null as object | null, isPlaying: false, retreatId: null as string | null, inlinePlayerVisible: false };

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, usePathname: () => '/retreats/MT1' }));
jest.mock('@/hooks/useTabBarHeight', () => ({ useTabBarHeight: () => 83 }));
jest.mock('@/contexts/AudioPlayerContext', () => ({ useAudioPlayerContext: () => mockPlayer }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: () => undefined, language: 'en' }) }));

describe('useBottomBarsSpace', () => {
  it('should clear only the tab bar when nothing is playing', () => {
    mockPlayer = { currentTrack: null, isPlaying: false, retreatId: null, inlinePlayerVisible: false };

    const { result } = renderHook(() => useBottomBarsSpace());

    expect(result.current).toBe(83 + 16);
  });

  it('should also clear the mini player when it shows', () => {
    mockPlayer = { currentTrack: { id: 't1' }, isPlaying: true, retreatId: 'r9', inlinePlayerVisible: false };

    const { result } = renderHook(() => useBottomBarsSpace());

    expect(result.current).toBe(83 + 60 + 16);
  });
});
