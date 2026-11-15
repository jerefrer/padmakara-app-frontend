import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';

let mockSegments: string[];
let mockShellProps: { rightSidebar?: any; rightSidebarWidth?: number } = {};

jest.mock('@/hooks/useDesktopLayout', () => ({
  useDesktopLayout: () => ({
    isMobile: false, isTablet: false, isDesktop: true, showSidebar: true,
    sidebarWidth: 280, playerBarHeight: 80, showRightRail: true, compactSidebar: false,
  }),
}));
jest.mock('expo-router', () => {
  const Tabs: any = () => null;
  Tabs.Screen = () => null;
  return { Tabs, useSegments: () => mockSegments };
});
jest.mock('@/components/HapticTab', () => ({ HapticTab: () => null }));
jest.mock('@/components/ui/TabBarBackground', () => ({ __esModule: true, default: () => null }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
jest.mock('@/components/desktop/DesktopPlayerBar', () => ({ DesktopPlayerBar: () => null }));
jest.mock('@/components/MiniPlayer', () => ({ MiniPlayer: () => null, usePlayerBarAboveTabBar: () => false }));
jest.mock('@/components/desktop/Sidebar', () => ({ Sidebar: () => null }));
jest.mock('@/components/desktop/DesktopShell', () => ({
  DesktopShell: (props: any) => {
    mockShellProps = props;
    return null;
  },
}));
jest.mock('@/contexts/SidebarNavigationContext', () => ({
  SidebarNavigationProvider: ({ children }: any) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useTabBarHeight', () => ({ useTabBarHeight: () => 0 }));
jest.mock('@/utils/readerImmersive', () => ({ useReaderImmersive: () => false }));

import TabLayout from '@/app/(tabs)/_layout';

describe('(tabs) layout right panel on web desktop', () => {
  const originalOS = Platform.OS;
  beforeAll(() => {
    (Platform as any).OS = 'web';
  });
  afterAll(() => {
    (Platform as any).OS = originalOS;
  });

  it('should keep the wide right panel on the event page', () => {
    mockSegments = ['(tabs)', '(groups)', 'retreat', '[id]'];
    render(<TabLayout />);
    expect(mockShellProps.rightSidebarWidth).toBe(220);
    expect(mockShellProps.rightSidebar.props.variant).toBe('wide');
  });

  it('should keep the narrow rail on the transcript reader', () => {
    mockSegments = ['(tabs)', '(groups)', 'transcript', '[id]'];
    render(<TabLayout />);
    expect(mockShellProps.rightSidebarWidth).toBe(64);
    expect(mockShellProps.rightSidebar.props.variant).toBe('narrow');
  });
});
