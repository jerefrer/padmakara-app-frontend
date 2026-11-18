import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { EventRow } from '@/components/EventRow';
import type { Gathering } from '@/types';

jest.mock('@/contexts/AudioPlayerContext', () => ({ useAudioPlayerContext: () => ({}) }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));

const event = {
  id: '7',
  name: 'Lembrun',
  status: 'completed',
  guestIntro: 'with_presence_of',
  teachers: [
    { id: 1, name: 'Jigme Khyentse Rinpoche', abbreviation: 'JKR', role: 'teacher' },
    { id: 2, name: 'Pema Wangyal Rinpoche', abbreviation: 'PWR', role: 'teacher' },
    { id: 3, name: 'Shechen Rabjam Rinpoche', abbreviation: 'SRR', role: 'guest' },
  ],
} as unknown as Gathering;

describe('EventRow teachers', () => {
  it('should name only the main teachers in a compact row, never the guests', () => {
    render(<EventRow event={event} title="Lembrun" meta="" onPress={jest.fn()} />);

    expect(screen.getByText('Jigme Khyentse Rinpoche, Pema Wangyal Rinpoche')).toBeTruthy();
    expect(screen.queryByText(/Shechen Rabjam Rinpoche/)).toBeNull();
  });
});
