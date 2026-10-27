import { Platform, useWindowDimensions } from 'react-native';
import { computeLayout, type Layout } from '@/utils/layout';

export type DesktopLayout = Layout;

export function useDesktopLayout(): DesktopLayout {
  const { width } = useWindowDimensions();
  return computeLayout({
    platform: Platform.OS,
    isPad: Platform.OS === 'ios' && Platform.isPad === true,
    width,
  });
}
