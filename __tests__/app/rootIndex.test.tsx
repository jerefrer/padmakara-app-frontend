import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import RootIndex from '@/app/index';
import apiService from '@/services/apiService';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useGlobalSearchParams: () => ({ auto_activate: 'old-token' }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    isDeviceActivated: false,
    refreshAuth: jest.fn(),
  }),
}));
jest.mock('@/services/apiService', () => ({
  __esModule: true,
  default: {
    get: jest.fn(async () => ({ success: false })),
    post: jest.fn(async () => ({ success: false, error: 'Not found' })),
  },
}));

describe('root index opened from an old auto_activate link', () => {
  it('should open the app normally without calling the server with the token', async () => {
    render(<RootIndex />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)/(groups)'));
    expect(apiService.post).not.toHaveBeenCalled();
  });
});
