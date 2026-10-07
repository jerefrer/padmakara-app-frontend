import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { OutcomeLayout } from '@/components/membership/OutcomeLayout';
import { ProcessingNotice } from '@/components/membership/ProcessingNotice';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text {...props}>{props.name}</Text> };
});
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

describe('OutcomeLayout', () => {
  it('should show a plain glyph in the given colour, not a tinted circle, when an icon is given', () => {
    const { getByTestId } = render(
      <OutcomeLayout icon="checkmark-circle-outline" iconColor="#15803d" title="Done" />,
    );
    const icon = getByTestId('outcome-icon');
    expect(icon.props.name).toBe('checkmark-circle-outline');
    expect(icon.props.color).toBe('#15803d');
  });

  it('should show no icon when none is given', () => {
    const { queryByTestId } = render(<OutcomeLayout title="Done" />);
    expect(queryByTestId('outcome-icon')).toBeNull();
  });

  it('should centre the title and body and use the settings button for the primary action', () => {
    const { getByText } = render(
      <OutcomeLayout title="Done" body="All good" primary={{ label: 'Go', onPress: jest.fn() }} />,
    );
    expect(StyleSheet.flatten(getByText('Done').props.style).textAlign).toBe('center');
    expect(StyleSheet.flatten(getByText('All good').props.style).textAlign).toBe('center');
    const button = getByText('Go').parent!.parent!;
    const style = StyleSheet.flatten(button.props.style);
    expect(style.borderRadius).toBe(2);
  });

  it('should use a clock glyph, not an emoji, for the bank-processing notice', () => {
    const { getByTestId, queryByText } = render(<ProcessingNotice onBack={jest.fn()} />);
    expect(getByTestId('outcome-icon').props.name).toBe('time-outline');
    expect(queryByText('⏳')).toBeNull();
  });
});
