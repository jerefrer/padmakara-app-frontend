import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import PublicationsScreen from '@/app/(tabs)/(groups)/publications';
import { publicationService } from '@/services/publicationService';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, hasActiveSubscription: true }),
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const locale = require('@/locales/en.json');
      const value = key.split('.').reduce((node: any, part) => node?.[part], locale);
      return typeof value === 'string' && params
        ? value.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k])
        : value;
    },
    language: 'en',
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ isDesktop: false }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/components/PDFViewer', () => ({ PDFViewer: () => null }));
jest.mock('@/services/publicationService', () => ({
  publicationService: { getPublicationsSync: jest.fn(() => null), getPublications: jest.fn() },
}));

const pub = (id: string, language: string) => ({
  id, title: `Title ${id}`, author: 'Author', language, createdAt: '2026-01-01', updatedAt: '2026-01-01',
});

beforeEach(() => {
  (Platform as any).OS = 'ios';
  (publicationService.getPublications as jest.Mock).mockResolvedValue({
    publications: [pub('1', 'en'), pub('2', 'pt')],
    hasHiddenPublications: false,
  });
});

describe('publications language filter button', () => {
  it('should show a globe button without a badge when no language is selected', async () => {
    const { findByTestId, queryByTestId } = render(<PublicationsScreen />);
    const button = await findByTestId('publications-language-button');
    expect(button.props.accessibilityLabel).toBe('Filter by language');
    expect(queryByTestId('publications-language-badge')).toBeNull();
  });

  it('should open the language list when the globe is pressed', async () => {
    const { findByTestId, findByText } = render(<PublicationsScreen />);
    fireEvent.press(await findByTestId('publications-language-button'));
    expect(await findByText('All languages')).toBeTruthy();
  });

  it('should show a badge and a descriptive label once a language is selected', async () => {
    const { findByTestId, findByText } = render(<PublicationsScreen />);
    fireEvent.press(await findByTestId('publications-language-button'));
    fireEvent.press(await findByText('English'));
    expect(await findByTestId('publications-language-badge')).toBeTruthy();
    expect((await findByTestId('publications-language-button')).props.accessibilityLabel).toContain('English');
  });
});
