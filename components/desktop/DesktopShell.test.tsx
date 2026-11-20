import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { setReaderFullWindow } from '@/utils/readerImmersive';

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

describe('DesktopShell with a document reader open', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    act(() => setReaderFullWindow(false));
    Platform.OS = originalOS;
  });

  it('should hide the sidebar, right panel, shadows and player bar on the web, keeping the page', () => {
    Platform.OS = 'web';
    const { queryByTestId, getByText } = render(
      <DesktopShell sidebar={<Text>s</Text>} rightSidebar={<Text>r</Text>} playerBar={<Text>p</Text>}>
        <Text>c</Text>
      </DesktopShell>,
    );
    expect(queryByTestId('shadow-main-left')).toBeTruthy();

    act(() => setReaderFullWindow(true));

    expect(queryByTestId('shadow-main-left')).toBeNull();
    expect(queryByTestId('shadow-right-panel-left')).toBeNull();
    for (const label of ['s', 'r', 'p']) {
      expect(StyleSheet.flatten(getByText(label, { includeHiddenElements: true }).parent!.parent!.props.style).display).toBe('none');
    }
    expect(getByText('c')).toBeTruthy();
  });

  it('should let the page fill the area even when the column is capped', () => {
    Platform.OS = 'web';
    const { getByTestId } = render(
      <DesktopShell sidebar={<Text>s</Text>} rightSidebar={<Text>r</Text>}>
        <Text>c</Text>
      </DesktopShell>,
    );
    act(() => setReaderFullWindow(true));
    expect(StyleSheet.flatten(getByTestId('main-column').props.style).maxWidth).toBeUndefined();
  });

  it('should hide the rails and the player bar on an iPad', () => {
    Platform.OS = 'ios';
    const { queryByText } = render(
      <DesktopShell sidebar={<Text>s</Text>} rightSidebar={<Text>r</Text>} playerBar={<Text>p</Text>}>
        <Text>c</Text>
      </DesktopShell>,
    );
    expect(queryByText('s')).toBeTruthy();

    act(() => setReaderFullWindow(true));

    expect(queryByText('s')).toBeNull();
    expect(queryByText('r')).toBeNull();
    expect(queryByText('p')).toBeNull();
    expect(queryByText('c')).toBeTruthy();
  });
});
