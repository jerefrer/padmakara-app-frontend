import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { NameGate } from '@/components/auth/NameGate';
import { hasUserName, splitUserName } from '@/utils/userName';

const mockUpdateUser = jest.fn();
let mockAuth: any;
let mockPathname = '/';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('expo-router', () => ({ usePathname: () => mockPathname }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));

const nameless = { id: '1', name: 'ana@example.pt', email: 'ana@example.pt' };

beforeEach(() => {
  mockPathname = '/';
  mockUpdateUser.mockResolvedValue({ success: true });
  mockAuth = { isAuthenticated: true, user: nameless, updateUser: mockUpdateUser };
});

describe('NameGate', () => {
  it('should ask for the name when the signed-in account has none', () => {
    const { getByTestId } = render(<NameGate />);
    expect(getByTestId('name-step')).toBeTruthy();
  });

  it('should ask for the name when the API sent an empty name', () => {
    mockAuth.user = { ...nameless, name: '' };
    const { getByTestId } = render(<NameGate />);
    expect(getByTestId('name-step')).toBeTruthy();
  });

  it('should not show when the account has a name', () => {
    mockAuth.user = { ...nameless, name: 'Ana Silva' };
    const { queryByTestId } = render(<NameGate />);
    expect(queryByTestId('name-step')).toBeNull();
  });

  it('should not show to a signed-out visitor', () => {
    mockAuth = { isAuthenticated: false, user: null, updateUser: mockUpdateUser };
    const { queryByTestId } = render(<NameGate />);
    expect(queryByTestId('name-step')).toBeNull();
  });

  it.each(['/delete-account', '/account-deletion', '/privacy-policy', '/magic-link', '/check-email'])(
    'should stay out of the way on %s',
    (path) => {
      mockPathname = path;
      const { queryByTestId } = render(<NameGate />);
      expect(queryByTestId('name-step')).toBeNull();
    },
  );

  it('should save the trimmed name through updateUser when Continue is pressed', async () => {
    const { getByTestId } = render(<NameGate />);
    fireEvent.changeText(getByTestId('name-first'), ' Ana ');
    fireEvent.changeText(getByTestId('name-last'), ' Silva ');
    await act(async () => {
      fireEvent.press(getByTestId('name-submit'));
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ first_name: 'Ana', last_name: 'Silva' });
  });

  it('should keep Continue disabled while the first name is empty', () => {
    const { getByTestId } = render(<NameGate />);
    expect(getByTestId('name-submit').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByTestId('name-submit'));
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('should show the error and stay on the step when the save fails', async () => {
    mockUpdateUser.mockResolvedValue({ success: false, error: 'Update failed' });
    const { getByTestId } = render(<NameGate />);
    fireEvent.changeText(getByTestId('name-first'), 'Ana');
    await act(async () => {
      fireEvent.press(getByTestId('name-submit'));
    });
    expect(getByTestId('name-error')).toBeTruthy();
    expect(getByTestId('name-step')).toBeTruthy();
  });

  it('should go away once the saved user carries a name', async () => {
    const { getByTestId, queryByTestId, rerender } = render(<NameGate />);
    fireEvent.changeText(getByTestId('name-first'), 'Ana');
    await act(async () => {
      fireEvent.press(getByTestId('name-submit'));
    });
    mockAuth = { ...mockAuth, user: { ...nameless, name: 'Ana' } };
    rerender(<NameGate />);
    expect(queryByTestId('name-step')).toBeNull();
  });
});

describe('userName helpers', () => {
  it('should treat a name equal to the email, ignoring case, as missing', () => {
    expect(hasUserName({ name: 'Ana@Example.pt', email: 'ana@example.pt' })).toBe(false);
  });

  it('should split a name into first word and the rest', () => {
    expect(splitUserName({ name: 'Ana Maria Silva', email: 'a@b.pt' })).toEqual({ firstName: 'Ana', lastName: 'Maria Silva' });
  });

  it('should use the first and last name the API sends instead of splitting', () => {
    expect(
      splitUserName({ name: 'Maria João Silva', email: 'a@b.pt', first_name: 'Maria João', last_name: 'Silva' }),
    ).toEqual({ firstName: 'Maria João', lastName: 'Silva' });
  });

  it('should see no name when the API sends empty first and last names', () => {
    expect(hasUserName({ name: 'a@b.pt', email: 'a@b.pt', first_name: '', last_name: '' })).toBe(false);
  });
});
