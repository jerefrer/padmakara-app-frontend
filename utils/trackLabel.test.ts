import { getNumberedTrackTitle } from './trackLabel';
import type { Track } from '@/types';

jest.mock('@/utils/i18n', () => ({ getTrackTitle: (t: { title: string }) => t.title }));

const track = (order: number): Track =>
  ({ id: 't', title: 'Teaching', order } as unknown as Track);

describe('getNumberedTrackTitle', () => {
  it('should prefix the title with the track number when the track has one', () => {
    expect(getNumberedTrackTitle(track(2), 'en')).toBe('2 · Teaching');
  });

  it('should return the bare title when the track has no number', () => {
    expect(getNumberedTrackTitle(track(0), 'en')).toBe('Teaching');
  });
});
