import React from 'react';
import { Image } from 'react-native';
import { render } from '@testing-library/react-native';

import { RightSidebar } from './RightSidebar';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  usePathname: () => '/',
}));
jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ playerBarHeight: 80 }) }));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Ana Silva' },
    isAuthenticated: true,
    forgetDevice: jest.fn(),
  }),
}));
jest.mock('@/components/auth/SignInProvider', () => ({ useSignIn: () => ({ openSignIn: jest.fn() }) }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: () => '' }) }));
jest.mock('@/contexts/AudioPlayerContext', () => ({ useAudioPlayerContext: () => ({ clearTrack: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

describe('RightSidebar', () => {
  it('should show the full logo and Ramo Lusófono when wide', () => {
    const { getByTestId, getByText } = render(<RightSidebar variant="wide" />);
    expect(getByTestId('brand-panel-logo')).toBeTruthy();
    expect(getByText('Ramo Lusófono')).toBeTruthy();
  });

  it('should render no logo at all when narrow, keeping the account avatar', () => {
    const { UNSAFE_queryAllByType, queryByTestId, queryByText, getByLabelText, getByText } = render(
      <RightSidebar variant="narrow" />,
    );
    expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(queryByTestId('brand-panel-logo')).toBeNull();
    expect(queryByText('Ramo Lusófono')).toBeNull();
    expect(getByLabelText('Ana Silva')).toBeTruthy();
    expect(getByText('AS')).toBeTruthy();
  });
});
