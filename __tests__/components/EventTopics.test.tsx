import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { EventTopics } from '@/components/EventTopics';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

describe('EventTopics', () => {
  it('should show the main topics exactly as entered', () => {
    const { getByText } = render(<EventTopics main={'A | B\n\nC'} sessions={[]} hasTrack={() => true} onOpenTrack={jest.fn()} />);
    expect(getByText('A | B\n\nC')).toBeTruthy();
  });

  it('should open the first track of a range when its link is pressed', () => {
    const onOpenTrack = jest.fn();
    const { getByText } = render(
      <EventTopics
        main={null}
        sessions={[{ text: 'Main topics: X', trackRange: { start: 7, end: 12 } }]}
        hasTrack={() => true}
        onOpenTrack={onOpenTrack}
      />,
    );
    fireEvent.press(getByText('Listen to tracks 7–12'));
    expect(onOpenTrack).toHaveBeenCalledWith(7);
  });

  it('should not offer a link when the range has no track on this event', () => {
    const { queryByText, getByText } = render(
      <EventTopics
        main={null}
        sessions={[{ text: 'Main topics: X', trackRange: { start: 7, end: 12 } }]}
        hasTrack={() => false}
        onOpenTrack={jest.fn()}
      />,
    );
    expect(getByText('Main topics: X')).toBeTruthy();
    expect(queryByText('Listen to tracks 7–12')).toBeNull();
  });

  it('should word a single track in the singular', () => {
    const { getByText } = render(
      <EventTopics
        main={null}
        sessions={[{ text: 'X', trackRange: { start: 5, end: 5 } }]}
        hasTrack={() => true}
        onOpenTrack={jest.fn()}
      />,
    );
    expect(getByText('Listen to track 5')).toBeTruthy();
  });
});
