import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { MembershipCard } from '@/components/membership/MembershipCard';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

beforeEach(() => jest.clearAllMocks());

describe('MembershipCard (home invitation)', () => {
  it('should show the section label, the sentence and a Become a member button leading to /membership', () => {
    const { getByTestId, getByText } = render(<MembershipCard />);
    expect(getByTestId('membership-invite')).toBeTruthy();
    expect(getByText('Membership')).toBeTruthy();
    expect(getByText('Your contribution keeps the teachings available to everyone.')).toBeTruthy();
    fireEvent.press(getByText('Become a member'));
    expect(mockPush).toHaveBeenCalledWith('/membership');
  });

  it('should not draw a rounded tinted box', () => {
    const { getByTestId } = render(<MembershipCard />);
    const style = StyleSheet.flatten(getByTestId('membership-invite').props.style) ?? {};
    expect(style.borderRadius).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();
  });
});
