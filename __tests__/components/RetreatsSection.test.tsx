import React from 'react';
import { render } from '@testing-library/react-native';

import { RetreatsSection } from '@/components/settings/AccountSections';
import retreatService from '@/services/retreatService';

const mockPush = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('expo-router', () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ hasActiveSubscription: true }) }));
jest.mock('@/services/retreatService', () => ({
  __esModule: true,
  default: { getUserRetreats: jest.fn() },
}));

describe('RetreatsSection', () => {
  it('should list the open groups as read-only rows when groups are loaded', async () => {
    (retreatService.getUserRetreats as jest.Mock).mockResolvedValue({
      success: true,
      data: { retreat_groups: [{ id: 7, name: 'Lisbon', abbreviation: 'lis', gatherings: [{}, {}] }] },
    });
    const { findByTestId, queryByText } = render(<RetreatsSection />);
    const row = await findByTestId('settings-group-7');
    expect(row.props.accessibilityRole).toBeUndefined();
    expect(queryByText('chevron-forward')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
