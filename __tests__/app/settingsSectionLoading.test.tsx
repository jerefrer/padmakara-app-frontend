import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import SettingsSectionScreen from '@/app/(tabs)/settings/[section]';

let mockAuth = { isAuthenticated: true, isInitialized: true, isLoading: false };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ section: 'device' }),
  Redirect: () => null,
  router: { back: jest.fn(), canGoBack: () => false, replace: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: () => undefined }) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/components/ui/BackButton', () => ({ BackButton: () => null }));
jest.mock('@/components/settings/SectionBody', () => {
  const { Text: T } = require('react-native');
  return { SectionBody: () => <T>section-body</T> };
});
jest.mock('@/components/settings/sections', () => ({
  visibleSections: () => [{ id: 'device', labelKey: 'x', fallback: 'Device' }],
}));

describe('settings section page', () => {
  it('should render nothing before the first auth check has finished', () => {
    mockAuth = { isAuthenticated: false, isInitialized: false, isLoading: true };
    const { queryByText } = render(<SettingsSectionScreen />);
    expect(queryByText('section-body')).toBeNull();
  });

  it('should keep rendering when isLoading flips on after initialization', () => {
    mockAuth = { isAuthenticated: true, isInitialized: true, isLoading: true };
    const { getByText } = render(<SettingsSectionScreen />);
    expect(getByText('section-body')).toBeTruthy();
  });
});
