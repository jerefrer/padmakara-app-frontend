import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

import EventsScreen from '@/app/(tabs)/_events/index';
import retreatService from '@/services/retreatService';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useGlobalSearchParams: () => ({}),
  useSegments: () => [],
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ isDesktop: false, isMobile: true }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/services/retreatService', () => ({
  __esModule: true,
  default: {
    getPublicEventsSync: jest.fn(() => null),
    getPublicEvents: jest.fn(),
  },
}));

describe('EventsScreen retry button', () => {
  it('should reload public events with force true when retry is pressed', async () => {
    // Arrange
    const getPublicEvents = retreatService.getPublicEvents as jest.Mock;
    getPublicEvents.mockResolvedValue({ success: false, error: 'Network down' });
    const { findByText } = render(<EventsScreen />);
    const retry = await findByText('Retry');
    await waitFor(() => expect(getPublicEvents).toHaveBeenCalledTimes(1));
    expect(getPublicEvents).toHaveBeenLastCalledWith({ force: false });

    // Act
    fireEvent.press(retry);

    // Assert
    await waitFor(() => expect(getPublicEvents).toHaveBeenCalledTimes(2));
    expect(getPublicEvents).toHaveBeenLastCalledWith({ force: true });
  });
});
