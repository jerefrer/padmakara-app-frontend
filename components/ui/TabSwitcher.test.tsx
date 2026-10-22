import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TabSwitcher } from './TabSwitcher';

const tabs = [
  { key: 'a', label: 'First', testID: 'tab-a' },
  { key: 'b', label: 'Second', testID: 'tab-b' },
];

describe('TabSwitcher', () => {
  it('should mark only the active tab as selected when rendered', () => {
    const { getByTestId } = render(<TabSwitcher tabs={tabs} activeKey="b" onChange={() => {}} />);
    expect(getByTestId('tab-a').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('tab-b').props.accessibilityState.selected).toBe(true);
  });

  it('should report the pressed tab key when a tab is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<TabSwitcher tabs={tabs} activeKey="a" onChange={onChange} />);
    fireEvent.press(getByTestId('tab-b'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
