import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { BackButton } from '@/components/ui/BackButton';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text testID={`icon-${props.name}`}>{props.color}</Text> };
});
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), canGoBack: () => mockCanGoBack, replace: (...a: any[]) => mockReplace(...a) },
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = true;
});

describe('BackButton', () => {
  it('should render a chevron and the default Back label and go back when pressed', () => {
    const { getByText, getByLabelText, getByTestId } = render(<BackButton />);
    expect(getByTestId('icon-chevron-back')).toBeTruthy();
    expect(getByText('Back')).toBeTruthy();
    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('should render a custom label and use it as the accessibility label', () => {
    const { getByText, getByLabelText } = render(<BackButton label="Settings" />);
    expect(getByText('Settings')).toBeTruthy();
    expect(getByLabelText('Settings').props.accessibilityRole).toBe('button');
  });

  it('should open the fallback when there is no history to go back to', () => {
    mockCanGoBack = false;
    const { getByLabelText } = render(<BackButton fallback="/membership" />);
    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/membership');
  });

  it('should keep a hit area at least 44 high and no box around the control', () => {
    const { getByLabelText } = render(<BackButton />);
    const style = StyleSheet.flatten(getByLabelText('Back').props.style) ?? {};
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.borderWidth).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();
  });

  it('should show only the chevron in the inline variant when no label is given', () => {
    const { queryByText, getByLabelText, getByTestId } = render(<BackButton variant="inline" />);
    expect(getByTestId('icon-chevron-back')).toBeTruthy();
    expect(queryByText('Back')).toBeNull();
    expect(getByLabelText('Back')).toBeTruthy();
  });

  it('should call a custom handler instead of navigating when onPress is given', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<BackButton variant="inline" onPress={onPress} />);
    fireEvent.press(getByLabelText('Back'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('should render a white chevron with an accessibility label in the overlay variant', () => {
    const { getByLabelText, getByTestId, queryByText } = render(<BackButton variant="overlay" />);
    expect(getByLabelText('Back').props.accessibilityRole).toBe('button');
    expect(getByTestId('icon-chevron-back').props.children).toBe('#ffffff');
    expect(queryByText('Back')).toBeNull();
    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
