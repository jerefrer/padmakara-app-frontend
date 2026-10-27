import React from 'react';
import { render } from '@testing-library/react-native';

let mockMountCount = 0;
let mockLayoutState: Record<string, unknown>;

const mobileLayout = {
  isMobile: true, isTablet: false, isDesktop: false, showSidebar: false,
  sidebarWidth: 280, playerBarHeight: 80, showRightRail: false, compactSidebar: false,
};
const tabletLayout = {
  ...mobileLayout, isMobile: false, isTablet: true, showSidebar: true,
  sidebarWidth: 72, compactSidebar: true,
};
const desktopLayout = {
  ...mobileLayout, isMobile: false, isDesktop: true, showSidebar: true, showRightRail: true,
};

jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => mockLayoutState }));
jest.mock('expo-router', () => {
  const R = require('react');
  const Tabs: any = () => {
    R.useEffect(() => {
      mockMountCount += 1;
    }, []);
    return null;
  };
  Tabs.Screen = () => null;
  return { Tabs, useSegments: () => [], router: {}, usePathname: () => '/' };
});
jest.mock('@/components/HapticTab', () => ({ HapticTab: () => null }));
jest.mock('@/components/ui/TabBarBackground', () => ({ __esModule: true, default: () => null }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
jest.mock('@/components/desktop/DesktopPlayerBar', () => ({ DesktopPlayerBar: () => require('react').createElement(require('react-native').Text, null, 'bar') }));
jest.mock('@/components/MiniPlayer', () => ({ MiniPlayer: () => require('react').createElement(require('react-native').Text, null, 'mini') }));
jest.mock('@/components/desktop/Sidebar', () => ({ Sidebar: () => require('react').createElement(require('react-native').Text, null, 'sidebar') }));
jest.mock('@/components/desktop/RightSidebar', () => ({ RightSidebar: () => require('react').createElement(require('react-native').Text, null, 'right') }));
jest.mock('@/contexts/SidebarNavigationContext', () => ({
  SidebarNavigationProvider: ({ children }: any) => children,
}));
jest.mock('@/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: () => undefined }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 20, left: 0, right: 0 }),
}));

import TabLayout from '@/app/(tabs)/_layout';

describe('(tabs) layout on native', () => {
  beforeEach(() => {
    mockMountCount = 0;
  });

  it('should not remount the navigator when the width crosses breakpoints', () => {
    mockLayoutState = mobileLayout;
    const { rerender, queryByText } = render(<TabLayout />);
    expect(mockMountCount).toBe(1);
    expect(queryByText('mini')).not.toBeNull();
    expect(queryByText('sidebar')).toBeNull();

    mockLayoutState = tabletLayout;
    rerender(<TabLayout />);
    expect(queryByText('sidebar')).not.toBeNull();
    expect(queryByText('bar')).not.toBeNull();
    expect(queryByText('right')).toBeNull();
    expect(queryByText('mini')).toBeNull();

    mockLayoutState = desktopLayout;
    rerender(<TabLayout />);
    expect(queryByText('right')).not.toBeNull();

    mockLayoutState = mobileLayout;
    rerender(<TabLayout />);
    expect(queryByText('sidebar')).toBeNull();
    expect(queryByText('mini')).not.toBeNull();

    expect(mockMountCount).toBe(1);
  });
});
