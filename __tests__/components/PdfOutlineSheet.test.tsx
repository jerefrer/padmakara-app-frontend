import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { PdfOutlineSheet } from '@/components/PdfOutlineSheet';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

const items = [
  { title: 'Day one', page: 3, depth: 0 },
  { title: 'Morning', page: 4, depth: 1 },
  { title: 'Day two', page: 15, depth: 0 },
];

describe('PdfOutlineSheet', () => {
  it('should list every entry with its page', () => {
    const { getByText } = render(
      <PdfOutlineSheet visible items={items} currentPage={1} onSelect={jest.fn()} onClose={jest.fn()} />
    );

    expect(getByText('Day one')).toBeTruthy();
    expect(getByText('Morning')).toBeTruthy();
    expect(getByText('p. 15')).toBeTruthy();
  });

  it('should go to the entry page and close when an entry is tapped', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <PdfOutlineSheet visible items={items} currentPage={1} onSelect={onSelect} onClose={onClose} />
    );

    fireEvent.press(getByText('Day two'));

    expect(onSelect).toHaveBeenCalledWith(15);
    expect(onClose).toHaveBeenCalled();
  });

  it('should mark the section the reader is in', () => {
    const { getByTestId } = render(
      <PdfOutlineSheet visible items={items} currentPage={9} onSelect={jest.fn()} onClose={jest.fn()} />
    );

    expect(getByTestId('outline-item-1').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('outline-item-2').props.accessibilityState).toEqual({ selected: false });
  });
});
