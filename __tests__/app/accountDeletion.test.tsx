import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import AccountDeletionScreen from '@/app/account-deletion';
import apiService from '@/services/apiService';
import { API_ENDPOINTS } from '@/services/apiConfig';

let mockParams: Record<string, string | undefined> = {};
const mockSetLanguage = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);
let mockAuthenticated = false;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: { back: jest.fn(), canGoBack: () => false, replace: jest.fn() },
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en', setLanguage: mockSetLanguage }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mockAuthenticated, logout: mockLogout }),
}));
jest.mock('@/services/apiService', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const post = apiService.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockAuthenticated = false;
});

describe('account deletion page without a token', () => {
  it('should name the app, say what is deleted and kept, and mention the in-app path', () => {
    const { getByText } = render(<AccountDeletionScreen />);
    expect(getByText(/run by Associação Padmakara Portugal/)).toBeTruthy();
    expect(getByText(/Settings, then Delete account/)).toBeTruthy();
    expect(getByText(/Records of payments made to the Association are kept/)).toBeTruthy();
  });

  it('should refuse to submit an invalid email without calling the API', () => {
    const { getByPlaceholderText, getByText } = render(<AccountDeletionScreen />);
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'not-an-email');
    fireEvent.press(getByText('Send confirmation link'));
    expect(getByText('Please enter a valid email address.')).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it('should request a link and show the neutral message when the email is submitted', async () => {
    post.mockResolvedValue({ success: true });
    const { getByPlaceholderText, getByText } = render(<AccountDeletionScreen />);
    fireEvent.changeText(getByPlaceholderText('you@example.com'), ' me@example.com ');
    fireEvent.press(getByText('Send confirmation link'));

    await waitFor(() => expect(getByText('Check your email')).toBeTruthy());
    expect(post).toHaveBeenCalledWith(API_ENDPOINTS.ACCOUNT_DELETION_REQUEST, {
      email: 'me@example.com',
      language: 'en',
    });
    expect(getByText(/If an account exists for this address/)).toBeTruthy();
  });

  it('should show an error and keep the form when the request fails', async () => {
    post.mockResolvedValue({ success: false, error: 'boom' });
    const { getByPlaceholderText, getByText } = render(<AccountDeletionScreen />);
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'me@example.com');
    fireEvent.press(getByText('Send confirmation link'));

    await waitFor(() => expect(getByText(/could not send the request/)).toBeTruthy());
    expect(getByText('Send confirmation link')).toBeTruthy();
  });

  it('should switch language from the header link', () => {
    const { getByText } = render(<AccountDeletionScreen />);
    fireEvent.press(getByText('Português'));
    expect(mockSetLanguage).toHaveBeenCalledWith('pt');
  });
});

describe('account deletion page with a token', () => {
  beforeEach(() => {
    mockParams = { token: 'abc123' };
  });

  it('should warn and offer the permanent delete button', () => {
    const { getByText } = render(<AccountDeletionScreen />);
    expect(getByText(/permanently delete your Padmakara account/)).toBeTruthy();
    expect(getByText('Delete my account permanently')).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it('should confirm with the token and show success', async () => {
    post.mockResolvedValue({ success: true });
    const { getByText } = render(<AccountDeletionScreen />);
    fireEvent.press(getByText('Delete my account permanently'));

    await waitFor(() => expect(getByText('Your account has been deleted')).toBeTruthy());
    expect(post).toHaveBeenCalledWith(API_ENDPOINTS.ACCOUNT_DELETION_CONFIRM, { token: 'abc123' });
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('should sign out a device that was signed in as the deleted account', async () => {
    mockAuthenticated = true;
    post.mockResolvedValue({ success: true });
    const { getByText } = render(<AccountDeletionScreen />);
    fireEvent.press(getByText('Delete my account permanently'));

    await waitFor(() => expect(getByText('Your account has been deleted')).toBeTruthy());
    expect(mockLogout).toHaveBeenCalled();
  });

  it('should offer a new link when the token is invalid or expired', async () => {
    post.mockResolvedValue({ success: false, code: 'INVALID_TOKEN', status: 400, error: 'x' });
    const { getByText, queryByText } = render(<AccountDeletionScreen />);
    fireEvent.press(getByText('Delete my account permanently'));

    await waitFor(() => expect(getByText(/invalid or has expired/)).toBeTruthy());
    expect(queryByText('Delete my account permanently')).toBeNull();
    fireEvent.press(getByText('Request a new link'));
    expect(getByText('Send confirmation link')).toBeTruthy();
  });

  it('should say nothing was deleted when the recurring payment could not be cancelled', async () => {
    post.mockResolvedValue({ success: false, code: 'PAYMENT_CANCEL_FAILED', status: 502, error: 'x' });
    const { getByText } = render(<AccountDeletionScreen />);
    fireEvent.press(getByText('Delete my account permanently'));

    await waitFor(() => expect(getByText(/so nothing was deleted/)).toBeTruthy());
    expect(getByText('Delete my account permanently')).toBeTruthy();
  });

  it('should show the admin message on a 409', async () => {
    post.mockResolvedValue({ success: false, code: 'ADMIN_ACCOUNT', status: 409, error: 'x' });
    const { getByText } = render(<AccountDeletionScreen />);
    fireEvent.press(getByText('Delete my account permanently'));

    await waitFor(() => expect(getByText(/cannot be deleted from here/)).toBeTruthy());
  });

  it('should show a generic error on any other failure', async () => {
    post.mockResolvedValue({ success: false, error: 'network' });
    const { getByText } = render(<AccountDeletionScreen />);
    fireEvent.press(getByText('Delete my account permanently'));

    await waitFor(() => expect(getByText(/could not delete the account/)).toBeTruthy());
  });
});
