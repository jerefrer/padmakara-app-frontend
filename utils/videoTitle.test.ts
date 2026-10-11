import { getVideoTitle } from './videoTitle';
import type { EventVideo } from '@/types';

const video = (overrides: Partial<EventVideo> = {}): EventVideo =>
  ({ id: 'v1', position: 0, ...overrides }) as EventVideo;

const t = (key: string, params?: Record<string, unknown>) =>
  key === 'video.part' ? `Part ${params?.n}` : key === 'video.untitled' ? 'Video' : '';

describe('getVideoTitle — language selection', () => {
  const bilingual = video({ titleEn: 'Morning Teaching', titlePt: 'Ensinamento da Manhã' });

  it('follows the interface language', () => {
    // A video title is app chrome, so it tracks the UI language rather than
    // the Portuguese audio-track preference.
    expect(getVideoTitle(bilingual, { language: 'en', t })).toBe('Morning Teaching');
    expect(getVideoTitle(bilingual, { language: 'pt', t })).toBe('Ensinamento da Manhã');
  });

  it('uses whichever title exists when the preferred one is missing', () => {
    expect(getVideoTitle(video({ titleEn: 'Only English' }), { language: 'pt', t })).toBe(
      'Only English',
    );
    expect(getVideoTitle(video({ titlePt: 'Só Português' }), { language: 'en', t })).toBe(
      'Só Português',
    );
  });

  it('ignores a blank title rather than rendering empty text', () => {
    expect(
      getVideoTitle(video({ titlePt: '   ', titleEn: 'Morning Teaching' }), {
        language: 'pt',
        t,
      }),
    ).toBe('Morning Teaching');
  });

  it('falls back to the generic label when no title is set', () => {
    expect(getVideoTitle(video(), { language: 'en', t })).toBe('Video');
  });

  it('appends a part number when the event has more than one video', () => {
    expect(
      getVideoTitle(video({ position: 2 }), { language: 'en', t, totalVideos: 3 }),
    ).toBe('Part 3');
  });
});
