import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { EventRow } from './EventRow';
import { RULE_LEFT_INSET, RULE_RIGHT_INSET, SUBDIVISION_COLOR, TEXT_GUTTER } from '@/constants/layout';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
jest.mock('@/components/NowPlayingBadge', () => ({ NowPlayingBadge: () => null }));

const event: any = { id: '1', status: 'forthcoming', teachers: [], sessions: [] };

describe('EventRow', () => {
  it('should place the forthcoming badge in the picture column, not in the title row', () => {
    const { getByTestId, getByText } = render(
      <EventRow event={event} title="A retreat" meta="" onPress={() => {}} testID="row" />,
    );
    const badge = getByTestId('forthcoming-badge');
    let node: any = badge.parent;
    const ancestors: any[] = [];
    while (node) { ancestors.push(node); node = node.parent; }
    const title = getByText('A retreat');
    expect(ancestors.some((a) => a === title.parent)).toBe(false);
  });

  it('should draw its separator in the light black from gutter to gutter on a phone', () => {
    const { getByTestId } = render(
      <EventRow event={{ ...event, status: 'published' }} title="T" meta="" onPress={() => {}} testID="row" />,
    );
    const style = StyleSheet.flatten(getByTestId('row').props.style);
    expect(style.borderBottomColor).toBe(SUBDIVISION_COLOR);
    expect(style.marginLeft).toBe(TEXT_GUTTER);
    expect(style.marginRight).toBe(TEXT_GUTTER);
    expect(RULE_LEFT_INSET).toBe(RULE_RIGHT_INSET);
  });
});
