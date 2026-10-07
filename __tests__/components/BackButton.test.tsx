import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { BackButton } from '@/components/membership/BackButton';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

describe('BackButton', () => {
  it('should render the default Back label as plain text and go back when pressed', () => {
    const { getByText, getByLabelText } = render(<BackButton />);
    expect(getByText('‹ Back')).toBeTruthy();
    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('should render a custom label', () => {
    const { getByText } = render(<BackButton label="Change amount" />);
    expect(getByText('‹ Change amount')).toBeTruthy();
  });

  it('should not draw a bordered box around the control', () => {
    const { getByLabelText } = render(<BackButton />);
    const style = StyleSheet.flatten(getByLabelText('Back').props.style) ?? {};
    expect(style.borderWidth).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();
  });
});
