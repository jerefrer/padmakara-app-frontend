import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { ReaderTopBar } from '@/components/ReaderTopBar';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

describe('ReaderTopBar', () => {
  it('should let taps through to its buttons while shown', () => {
    const { getByTestId } = render(
      <ReaderTopBar hidden={false}>
        <Text>Title</Text>
      </ReaderTopBar>
    );
    expect(getByTestId('reader-top-bar').props.pointerEvents).toBe('box-none');
  });

  it('should ignore taps and hide from screen readers while hidden', () => {
    const { getByTestId } = render(
      <ReaderTopBar hidden>
        <Text>Title</Text>
      </ReaderTopBar>
    );
    const bar = getByTestId('reader-top-bar', { includeHiddenElements: true });
    expect(bar.props.pointerEvents).toBe('none');
    expect(bar.props.accessibilityElementsHidden).toBe(true);
  });

  it('should clear the status bar unless told it is inside a sheet', () => {
    const flat = (style: any) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
    const page = render(<ReaderTopBar hidden={false}><Text>A</Text></ReaderTopBar>);
    expect(flat(page.getByTestId('reader-top-bar').props.style).paddingTop).toBe(47);

    const sheet = render(<ReaderTopBar hidden={false} clearStatusBar={false}><Text>B</Text></ReaderTopBar>);
    expect(flat(sheet.getByTestId('reader-top-bar').props.style).paddingTop).toBeUndefined();
  });
});
