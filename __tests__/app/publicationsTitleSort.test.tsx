import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';

import PublicationsScreen from '@/app/(tabs)/(groups)/publications';
import { publicationService } from '@/services/publicationService';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useFocusEffect: () => {},
  useLocalSearchParams: () => ({}),
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
  publicationService: { getPublicationsSync: jest.fn(() => null), getDeviceOpenTimes: jest.fn(() => Promise.resolve({})), recordOpen: jest.fn(() => Promise.resolve()), getPublications: jest.fn() },
}));

const pub = (id: string, title: string) => ({
  id, title, author: 'Author', language: 'pt', createdAt: '2026-01-01', updatedAt: '2026-01-01',
});

beforeEach(() => {
  (Platform as any).OS = 'ios';
  (publicationService.getPublications as jest.Mock).mockResolvedValue({
    publications: [
      pub('1', 'O Tesouro de Bênçãos'),
      pub('2', 'Infinita Vida e Sabedoria'),
      pub('3', 'Os Cinco Agregados'),
      pub('4', 'As Trinta e Sete Práticas'),
    ],
    hasHiddenPublications: false,
  });
});

describe('publications sorted by title', () => {
  it('should file titles under their first word after a leading article', async () => {
    render(<PublicationsScreen />);
    fireEvent.press(await screen.findByTestId('publications-tab-title'));
    const titles = (await screen.findAllByText(/./))
      .map((node) => node.props.children)
      .filter((text) => typeof text === 'string' && /Tesouro|Infinita|Cinco|Trinta/.test(text));
    expect(titles).toEqual([
      'Os Cinco Agregados',
      'Infinita Vida e Sabedoria',
      'O Tesouro de Bênçãos',
      'As Trinta e Sete Práticas',
    ]);
  });
});
