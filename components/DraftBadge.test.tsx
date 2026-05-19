import React from 'react';
import { render } from '@testing-library/react-native';
import { DraftBadge } from './DraftBadge';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

describe('DraftBadge', () => {
  it('renders the draft label', () => {
    const { getByText } = render(<DraftBadge />);
    expect(getByText('common.draft')).toBeTruthy();
  });
});
