import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { DesktopShell, EDGE_SHADOW_WIDTH } from './DesktopShell';
import { DESKTOP_CONTENT_MAX } from '@/constants/layout';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: () => undefined }));
jest.mock('@/hooks/useDesktopLayout', () => ({
  useDesktopLayout: () => ({
    sidebarWidth: 260,
    playerBarHeight: 80,
    showSidebar: true,
    showRightRail: true,
    isMobile: false,
  }),
}));

describe('DesktopShell', () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    Platform.OS = 'web';
  });
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('should cast a soft shadow on the main area and on the right panel edges', () => {
    const { getByTestId } = render(
      <DesktopShell sidebar={<Text>s</Text>} rightSidebar={<Text>r</Text>} playerBar={<Text>p</Text>}>
        <Text>c</Text>
      </DesktopShell>,
    );
    expect(getByTestId('shadow-main-left')).toBeTruthy();
    expect(getByTestId('shadow-right-panel-left')).toBeTruthy();
    expect(EDGE_SHADOW_WIDTH).toBe(12);
  });

  it('should cap the central column at the content maximum, centred', () => {
    const { getByTestId } = render(
      <DesktopShell sidebar={<Text>s</Text>} rightSidebar={<Text>r</Text>}>
        <Text>c</Text>
      </DesktopShell>,
    );
    const style = StyleSheet.flatten(getByTestId('main-column').props.style);
    expect(style.maxWidth).toBe(DESKTOP_CONTENT_MAX);
    expect(style.alignSelf).toBe('center');
  });

  it('should let the column fill the area when capping is turned off', () => {
    const { getByTestId } = render(
      <DesktopShell sidebar={<Text>s</Text>} rightSidebar={<Text>r</Text>} capContent={false}>
        <Text>c</Text>
      </DesktopShell>,
    );
    expect(StyleSheet.flatten(getByTestId('main-column').props.style).maxWidth).toBeUndefined();
  });
});
