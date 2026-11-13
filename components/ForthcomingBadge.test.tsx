import React from 'react';
import { render } from '@testing-library/react-native';
import { ForthcomingBadge } from './ForthcomingBadge';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

describe('ForthcomingBadge', () => {
  it('renders the forthcoming label', () => {
    const { getByText } = render(<ForthcomingBadge />);
    expect(getByText('common.forthcoming')).toBeTruthy();
  });
});
