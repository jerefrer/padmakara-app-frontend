import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { Sidebar } from './Sidebar';
import { colors } from '@/constants/colors';
import { RULE_COLOR } from '@/constants/layout';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  usePathname: () => '/',
  useSegments: () => ['(tabs)', '(groups)'],
  useGlobalSearchParams: () => ({}),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('@/components/auth/SignInProvider', () => ({ useSignIn: () => ({ openSignIn: jest.fn() }) }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: () => '' }) }));
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ compactSidebar: false }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

describe('Sidebar (desktop)', () => {
  it('should grey out the selected item without a tinted block or red bar', () => {
    const { getByText, getByLabelText } = render(<Sidebar />);
    const row = StyleSheet.flatten(getByLabelText("What's New").props.style);
    expect(row.backgroundColor).toBeUndefined();
    expect(row.borderLeftWidth).toBeUndefined();
    expect(StyleSheet.flatten(getByText("What's New").props.style).color).toBe(colors.gray[400]);
    expect(StyleSheet.flatten(getByText('Featured content and recent additions').props.style).color).toBe(
      colors.gray[400],
    );
  });

  it('should keep the normal colour on items that are not selected', () => {
    const { getByText } = render(<Sidebar />);
    expect(StyleSheet.flatten(getByText('Teachings & Talks').props.style).color).toBe(colors.gray[800]);
  });

  it('should draw red hairlines that reach the left edge between items', () => {
    const { getByLabelText, getAllByTestId } = render(<Sidebar />);
    const row = StyleSheet.flatten(getByLabelText('Teachings & Talks').props.style);
    expect(row.marginLeft).toBeUndefined();
    expect(row.borderBottomWidth).toBeUndefined();
    const line = StyleSheet.flatten(getAllByTestId('sidebar-hairline')[0].props.style);
    expect(line.backgroundColor).toBe(RULE_COLOR);
    expect(line.left).toBe(0);
  });

  it('should draw a hairline under every item except the last one at the bottom', () => {
    const { getAllByTestId } = render(<Sidebar />);
    // What's New, Teachings & Talks, Personal Library, Publications, My Bookmarks; not Search.
    expect(getAllByTestId('sidebar-hairline')).toHaveLength(5);
  });

  it('should not offer an Account item, the right panel being the way in', () => {
    const { queryByLabelText, getByLabelText } = render(<Sidebar />);
    expect(queryByLabelText('Account')).toBeNull();
    expect(getByLabelText('My Bookmarks')).toBeTruthy();
  });

  it('should list My Bookmarks right below Publications and keep Search last', () => {
    const { getAllByRole } = render(<Sidebar />);
    const labels = getAllByRole('link').map((el) => el.props.accessibilityLabel);
    expect(labels).toEqual([
      "What's New",
      'Teachings & Talks',
      'Personal Library',
      'Publications',
      'My Bookmarks',
      'Search',
    ]);
  });
});
