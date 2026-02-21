import { Platform, useWindowDimensions } from 'react-native';

export interface DesktopLayout {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  showSidebar: boolean;
  showMasterDetail: boolean;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  playerBarHeight: number;
}

export function useDesktopLayout(): DesktopLayout {
  const isWeb = Platform.OS === 'web';
  const { width } = useWindowDimensions();

  const isMobile = !isWeb || width < 768;
  const isTablet = isWeb && width >= 768 && width < 1025;
  const isDesktop = isWeb && width >= 1025;
  const isWide = isWeb && width > 1440;
  const showSidebar = isWeb && width >= 768;
  const sidebarCollapsed = isTablet;

  return {
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    showSidebar,
    showMasterDetail: isDesktop,
    sidebarCollapsed,
    sidebarWidth: sidebarCollapsed ? 64 : 240,
    playerBarHeight: 80,
  };
}
