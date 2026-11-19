import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { PdfOutlineSheet } from '@/components/PdfOutlineSheet';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));
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

  it('should close when the dimmed area around the sheet is tapped', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(
      <PdfOutlineSheet visible items={items} currentPage={1} onSelect={onSelect} onClose={onClose} />
    );

    fireEvent.press(getByTestId('outline-backdrop'));

    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('should keep the last entry clear of the home indicator', () => {
    const { getByTestId } = render(
      <PdfOutlineSheet visible items={items} currentPage={1} onSelect={jest.fn()} onClose={jest.fn()} />
    );

    expect(StyleSheet.flatten(getByTestId('outline-sheet').props.style).paddingBottom).toBe(34);
  });

  it('should mark the section the reader is in', () => {
    const { getByTestId } = render(
      <PdfOutlineSheet visible items={items} currentPage={9} onSelect={jest.fn()} onClose={jest.fn()} />
    );

    expect(getByTestId('outline-item-1').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('outline-item-2').props.accessibilityState).toEqual({ selected: false });
  });
});

describe('PdfOutlineSheet — bookmarked pages', () => {
  it('should list the bookmarked pages above the contents, each with its chapter', () => {
    const { getByText, getByTestId } = render(
      <PdfOutlineSheet visible items={items} bookmarks={[9, 20]} currentPage={1} onSelect={jest.fn()} onClose={jest.fn()} />
    );

    expect(getByText('Bookmarked pages')).toBeTruthy();
    expect(getByText('Page 9')).toBeTruthy();
    expect(getByText('Page 20')).toBeTruthy();
    expect(getByTestId('page-bookmark-open-9').props.accessibilityLabel).toBe('Page 9, Morning');
    expect(getByTestId('page-bookmark-open-20').props.accessibilityLabel).toBe('Page 20, Day two');
  });

  it('should go to a bookmarked page and close when it is tapped', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <PdfOutlineSheet visible items={items} bookmarks={[12]} currentPage={1} onSelect={onSelect} onClose={onClose} />
    );

    fireEvent.press(getByText('Page 12'));

    expect(onSelect).toHaveBeenCalledWith(12);
    expect(onClose).toHaveBeenCalled();
  });

  it('should remove a bookmark without leaving the sheet', () => {
    const onRemove = jest.fn();
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <PdfOutlineSheet
        visible
        items={items}
        bookmarks={[12]}
        currentPage={1}
        onSelect={jest.fn()}
        onClose={onClose}
        onRemoveBookmark={onRemove}
      />
    );

    fireEvent.press(getByLabelText('Remove the bookmark on page 12'));

    expect(onRemove).toHaveBeenCalledWith(12);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should title the sheet with the bookmarks when the document has no contents', () => {
    const { getAllByText, queryByText } = render(
      <PdfOutlineSheet visible items={[]} bookmarks={[4]} currentPage={1} onSelect={jest.fn()} onClose={jest.fn()} />
    );

    expect(getAllByText('Bookmarked pages')).toHaveLength(1);
    expect(queryByText('Contents')).toBeNull();
  });

  it('should open at the top, bookmarks in view, rather than on the section the reader is in', () => {
    const longOutline = Array.from({ length: 30 }, (_, i) => ({ title: `Part ${i + 1}`, page: i + 1, depth: 0 }));

    const withBookmarks = render(
      <PdfOutlineSheet visible items={longOutline} bookmarks={[4]} currentPage={25} onSelect={jest.fn()} onClose={jest.fn()} />
    );
    expect(withBookmarks.UNSAFE_getByType(FlatList).props.initialScrollIndex).toBeUndefined();
    withBookmarks.unmount();

    const without = render(
      <PdfOutlineSheet visible items={longOutline} currentPage={25} onSelect={jest.fn()} onClose={jest.fn()} />
    );
    expect(without.UNSAFE_getByType(FlatList).props.initialScrollIndex).toBe(21);
  });

  it('should still mark the section the reader is in below the bookmarks', () => {
    const { getByTestId } = render(
      <PdfOutlineSheet visible items={items} bookmarks={[2, 30]} currentPage={9} onSelect={jest.fn()} onClose={jest.fn()} />
    );

    expect(getByTestId('outline-item-1').props.accessibilityState).toEqual({ selected: true });
  });
});
