import React from 'react';
import { Linking, Platform, Text } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

import RetreatsListScreen from '@/app/(tabs)/(groups)/retreats/index';
import en from '@/locales/en.json';

const mockPush = jest.fn();
let mockUser: { id: string; email: string } | null = { id: 'u1', email: 'ana@example.com' };
const mockGetUserRetreats = jest.fn();
const mockMine = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: (...a: any[]) => mockPush(...a), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, user: mockUser }),
}));
jest.mock('@/components/auth/SignInProvider', () => ({ useSignIn: () => ({ openSignIn: jest.fn() }) }));
// Real English strings, so the assertions cover what people read.
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string, params?: Record<string, string>) => {
      const value = key.split('.').reduce((n: any, k) => n?.[k], require('@/locales/en.json'));
      if (typeof value !== 'string') return undefined;
      return value.replace(/\{\{(\w+)\}\}/g, (_m, k) => params?.[k] ?? '');
    },
  }),
}));
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ isDesktop: false, isMobile: true }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/components/ui/BackButton', () => ({ BackButton: () => null }));
jest.mock('@/components/NowPlayingBadge', () => ({ NowPlayingBadge: () => null }));
jest.mock('@/services/retreatService', () => ({
  __esModule: true,
  default: {
    getUserRetreatsSync: jest.fn(() => null),
    getUserRetreats: (...a: any[]) => mockGetUserRetreats(...a),
  },
}));
jest.mock('@/services/teachingService', () => ({
  teachingService: { mine: (...a: any[]) => mockMine(...a) },
}));

const group = {
  id: '1',
  name: 'Mandala',
  name_translations: { en: 'Mandala' },
  abbreviation: 'mandala',
  gatherings: [],
};
const teaching = {
  id: '77',
  name: 'Heart Sutra',
  name_translations: { en: 'Heart Sutra', pt: 'Sutra do Coração' },
  startDate: '2026-04-12',
  teachers: [{ name: 'Jigme Khyentse Rinpoche' }],
  sessions: [{ id: '1', tracks: [] }, { id: '2', tracks: [] }],
};
const data = (groups: any[]) => ({
  success: true,
  data: { retreat_groups: groups, recent_gatherings: [], total_stats: {} },
});

const originalOS = Platform.OS;
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const allText = (screen: ReturnType<typeof render>) =>
  screen.UNSAFE_getAllByType(Text).map((n) => [n.props.children].flat().join('')).join(' | ');
const FORBIDDEN = /price|buy|purchase|€|membership|subscri|\bpay/i;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'ana@example.com' };
  mockMine.mockResolvedValue({ success: true, data: [] });
  setOS('ios');
});
afterAll(() => setOS(originalOS));

describe('Retreats screen teachings section', () => {
  it('should list the teachings the user has access to', async () => {
    mockGetUserRetreats.mockResolvedValue(data([group]));
    mockMine.mockResolvedValue({ success: true, data: [teaching] });

    const screen = render(<RetreatsListScreen />);

    expect(await screen.findByText('Teachings')).toBeTruthy();
    expect(screen.getByText('Heart Sutra')).toBeTruthy();
    expect(screen.getByText('Mandala')).toBeTruthy();
  });

  it('should show a teaching with its teacher, date and session count, like the other lists', async () => {
    mockGetUserRetreats.mockResolvedValue(data([group]));
    mockMine.mockResolvedValue({ success: true, data: [teaching] });

    const screen = render(<RetreatsListScreen />);

    expect(await screen.findByText('Jigme Khyentse Rinpoche')).toBeTruthy();
    expect(screen.getByText('April 12, 2026 · 2 sessions')).toBeTruthy();
  });

  it('should open the event when a teaching is tapped', async () => {
    mockGetUserRetreats.mockResolvedValue(data([group]));
    mockMine.mockResolvedValue({ success: true, data: [teaching] });

    const screen = render(<RetreatsListScreen />);
    fireEvent.press(await screen.findByTestId('teaching-card-77'));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/(groups)/retreat/77');
  });

  it('should hide the section when there are no teachings', async () => {
    mockGetUserRetreats.mockResolvedValue(data([group]));

    const screen = render(<RetreatsListScreen />);
    await screen.findByText('Mandala');

    expect(screen.queryByText('Teachings')).toBeNull();
  });

  it('should still show the groups when loading teachings fails', async () => {
    mockGetUserRetreats.mockResolvedValue(data([group]));
    mockMine.mockRejectedValue(new Error('boom'));

    const screen = render(<RetreatsListScreen />);

    expect(await screen.findByText('Mandala')).toBeTruthy();
    expect(screen.queryByText('Teachings')).toBeNull();
  });

  it('should still show the groups when the teachings call reports a failure', async () => {
    mockGetUserRetreats.mockResolvedValue(data([group]));
    mockMine.mockResolvedValue({ success: false, data: [], error: 'down' });

    const screen = render(<RetreatsListScreen />);

    expect(await screen.findByText('Mandala')).toBeTruthy();
  });

  it('should show the teachings alone when the user has no groups', async () => {
    mockGetUserRetreats.mockResolvedValue(data([]));
    mockMine.mockResolvedValue({ success: true, data: [teaching] });

    const screen = render(<RetreatsListScreen />);

    expect(await screen.findByText('Heart Sutra')).toBeTruthy();
    expect(screen.queryByText(en.retreats.attendedTitle)).toBeNull();
  });
});

describe('Retreats screen header', () => {
  it('should head the groups with a Retreats title', async () => {
    mockGetUserRetreats.mockResolvedValue(data([group]));
    const screen = render(<RetreatsListScreen />);

    expect(await screen.findByText(en.retreats.retreatsSection)).toBeTruthy();
  });

  it('should leave the Retreats title out when the user has no groups', async () => {
    mockGetUserRetreats.mockResolvedValue(data([]));
    mockMine.mockResolvedValue({ success: true, data: [teaching] });
    const screen = render(<RetreatsListScreen />);

    await screen.findByText('Heart Sutra');
    expect(screen.queryByText(en.retreats.retreatsSection)).toBeNull();
  });

  it('should not list teacher names under the page title', async () => {
    const withTeacher = { ...group, gatherings: [{ id: '5', teachers: [{ name: 'Jigme Khyentse Rinpoche' }] }] };
    mockGetUserRetreats.mockResolvedValue(data([withTeacher]));
    const screen = render(<RetreatsListScreen />);

    await screen.findByText('Mandala');
    expect(screen.queryByText('Jigme Khyentse Rinpoche')).toBeNull();
  });

  it('should not name an organizer, since it can hold events organized by others', async () => {
    mockGetUserRetreats.mockResolvedValue(data([group]));
    const screen = render(<RetreatsListScreen />);
    await waitFor(() => expect(screen.getByTestId(`group-card-${group.id}`)).toBeTruthy());
    expect(screen.queryByText(/Kangyur Rinpoche Foundation/)).toBeNull();
  });
});

describe('Retreats screen empty state', () => {
  it('should not show the empty state before the teachings request settles', async () => {
    let resolveMine: (v: any) => void = () => {};
    mockMine.mockReturnValue(new Promise((r) => (resolveMine = r)));
    const retreatService = require('@/services/retreatService').default;
    retreatService.getUserRetreatsSync.mockReturnValueOnce({ retreat_groups: [], recent_gatherings: [], total_stats: {} });
    mockGetUserRetreats.mockResolvedValue(data([]));

    const screen = render(<RetreatsListScreen />);
    await waitFor(() => expect(mockMine).toHaveBeenCalled());
    expect(screen.queryByText(en.retreats.emptyExplanation)).toBeNull();
    expect(screen.queryByTestId('attended-retreat-card')).toBeNull();

    await act(async () => resolveMine({ success: true, data: [teaching] }));
    expect(await screen.findByText('Heart Sutra')).toBeTruthy();
    expect(screen.queryByText(en.retreats.attendedTitle)).toBeNull();
  });

  it.each(['ios', 'android', 'web'])(
    'should explain who the recordings are for and offer to write to us on %s',
    async (os) => {
      setOS(os);
      mockGetUserRetreats.mockResolvedValue(data([]));
      const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

      const screen = render(<RetreatsListScreen />);
      expect(await screen.findByText(en.retreats.emptyExplanation)).toBeTruthy();
      expect(screen.queryByText(/contact your administrator/i)).toBeNull();
      expect(screen.getByText(en.retreats.attendedTitle)).toBeTruthy();

      fireEvent.press(screen.getByTestId('attended-retreat-card'));

      const url = openURL.mock.calls[0][0] as string;
      expect(url.startsWith('mailto:info@padmakara.pt?')).toBe(true);
      expect(decodeURIComponent(url)).toContain('ana@example.com');
      expect(decodeURIComponent(url)).toContain(en.retreats.attendedMailSubject);
      openURL.mockRestore();
    },
  );

  it.each(['ios', 'web'])('should render no price, buy or membership wording on %s', async (os) => {
    setOS(os);
    mockGetUserRetreats.mockResolvedValue(data([]));

    const screen = render(<RetreatsListScreen />);
    await screen.findByText(en.retreats.emptyExplanation);

    const visible = allText(screen);
    expect(visible).toContain(en.retreats.attendedTitle);
    expect(visible.match(FORBIDDEN)).toBeNull();
    expect(visible).not.toMatch(/https?:/);
  });

  it('should render no price, buy or purchase link next to a listed teaching on native', async () => {
    setOS('ios');
    mockGetUserRetreats.mockResolvedValue(data([group]));
    mockMine.mockResolvedValue({ success: true, data: [teaching] });

    const screen = render(<RetreatsListScreen />);
    await screen.findByText('Heart Sutra');

    expect(allText(screen)).toContain('Heart Sutra');
    expect(allText(screen).match(FORBIDDEN)).toBeNull();
  });

  it('should not show the empty state while the user has teachings only', async () => {
    mockGetUserRetreats.mockResolvedValue(data([]));
    mockMine.mockResolvedValue({ success: true, data: [teaching] });

    const screen = render(<RetreatsListScreen />);
    await waitFor(() => expect(screen.getByText('Heart Sutra')).toBeTruthy());

    expect(screen.queryByText(en.retreats.emptyExplanation)).toBeNull();
  });
});
