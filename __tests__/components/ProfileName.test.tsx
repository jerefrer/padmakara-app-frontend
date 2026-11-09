import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { ProfileSection } from '@/components/settings/AccountSections';

const mockUpdateUser = jest.fn();
let mockUser: any;

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, updateUser: mockUpdateUser }),
}));

const submitDisabled = (node: any) => node.props.accessibilityState?.disabled === true;

beforeEach(() => {
  mockUser = { id: '1', name: 'Ana Maria Silva', email: 'ana@example.pt' };
  mockUpdateUser.mockResolvedValue({ success: true });
});

describe('ProfileSection name', () => {
  it('should open an edit prefilled with the first word as first name and the rest as last name when the name row is tapped', () => {
    const { getByTestId } = render(<ProfileSection />);
    fireEvent.press(getByTestId('settings-profile-name'));
    expect(getByTestId('name-first').props.value).toBe('Ana');
    expect(getByTestId('name-last').props.value).toBe('Maria Silva');
  });

  it('should leave the fields empty when the account has no name (the API then sends the email)', () => {
    mockUser = { id: '1', name: 'ana@example.pt', email: 'ana@example.pt' };
    const { getByTestId, getByText } = render(<ProfileSection />);
    expect(getByText('—')).toBeTruthy();
    fireEvent.press(getByTestId('settings-profile-name'));
    expect(getByTestId('name-first').props.value).toBe('');
    expect(getByTestId('name-last').props.value).toBe('');
  });

  it('should disable Save while the first name is empty', () => {
    const { getByTestId } = render(<ProfileSection />);
    fireEvent.press(getByTestId('settings-profile-name'));
    fireEvent.changeText(getByTestId('name-first'), '   ');
    expect(submitDisabled(getByTestId('name-submit'))).toBe(true);
    fireEvent.press(getByTestId('name-submit'));
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('should call updateUser with trimmed values and close the edit when Save succeeds', async () => {
    const { getByTestId, queryByTestId } = render(<ProfileSection />);
    fireEvent.press(getByTestId('settings-profile-name'));
    fireEvent.changeText(getByTestId('name-first'), '  Sofia ');
    fireEvent.changeText(getByTestId('name-last'), ' Costa  ');
    await act(async () => {
      fireEvent.press(getByTestId('name-submit'));
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ first_name: 'Sofia', last_name: 'Costa' });
    expect(queryByTestId('settings-profile-name-edit')).toBeNull();
    expect(getByTestId('settings-profile-name')).toBeTruthy();
  });

  it('should show an error and stay open when the save fails', async () => {
    mockUpdateUser.mockResolvedValue({ success: false, error: 'Update failed' });
    const { getByTestId, queryByTestId } = render(<ProfileSection />);
    fireEvent.press(getByTestId('settings-profile-name'));
    await act(async () => {
      fireEvent.press(getByTestId('name-submit'));
    });
    expect(getByTestId('name-error')).toBeTruthy();
    expect(queryByTestId('settings-profile-name-edit')).not.toBeNull();
  });

  it('should close the edit without saving when Cancel is pressed', () => {
    const { getByTestId, queryByTestId } = render(<ProfileSection />);
    fireEvent.press(getByTestId('settings-profile-name'));
    fireEvent.press(getByTestId('name-cancel'));
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(queryByTestId('name-form')).toBeNull();
  });
});
