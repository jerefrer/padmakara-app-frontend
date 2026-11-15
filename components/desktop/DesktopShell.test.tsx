import React from 'react';
import { Platform, Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { DesktopShell, EDGE_SHADOW_WIDTH } from './DesktopShell';

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
});
