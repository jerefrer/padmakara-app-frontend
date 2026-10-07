import React from 'react';
import { Platform } from 'react-native';
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
});
