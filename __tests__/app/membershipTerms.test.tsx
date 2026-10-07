import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import TermsScreen from '@/app/(tabs)/membership/terms';

const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: {
    replace: (...a: any[]) => mockReplace(...a),
    back: () => mockBack(),
    canGoBack: () => true,
  },
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as any).OS = 'web';
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

describe('membership terms screen', () => {
  it('should render a back control that goes back when there is history', () => {
    const { getByLabelText } = render(<TermsScreen />);
    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('should render the draft note as a plain paragraph, not a tinted box', () => {
    const { getByText } = render(<TermsScreen />);
    const note = getByText(/Draft/);
    expect(StyleSheet.flatten(note.parent?.props.style)?.backgroundColor).toBeUndefined();
  });

  it('should label each section with the settings section-label style', () => {
    const { getByText } = render(<TermsScreen />);
    const style = StyleSheet.flatten(getByText('Contribution').props.style);
    expect(style.textTransform).toBe('uppercase');
  });
});
