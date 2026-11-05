import { resolveContentTab, shouldShowInlinePlayer } from '@/utils/eventContentTab';
import {
  findTrackIndexByNumber,
  formatTrackRange,
  getEventTopics,
  parseSessionTopics,
} from '@/utils/eventTopics';

describe('parseSessionTopics', () => {
  it('should keep the line breaks of a block and pull out its track range', () => {
    const blocks = parseSessionTopics(
      'Jigme Khyentse Rinpoche\n14th April 2025 | Morning Session\n[Audio tracks 001-006] Main topic: Introduction',
    );
    expect(blocks).toEqual([
      {
        text: 'Jigme Khyentse Rinpoche\n14th April 2025 | Morning Session\nMain topic: Introduction',
        trackRange: { start: 1, end: 6 },
      },
    ]);
  });

  it('should split blocks only on blank lines', () => {
    const blocks = parseSessionTopics('First\nstill first\n\n\nSecond');
    expect(blocks.map((b) => b.text)).toEqual(['First\nstill first', 'Second']);
  });

  it('should read the Portuguese marker and uneven number widths', () => {
    expect(parseSessionTopics('[Faixas de áudio 013-24] Temas principais: Verso oito')[0]).toEqual({
      text: 'Temas principais: Verso oito',
      trackRange: { start: 13, end: 24 },
    });
  });

  it('should read a capitalised marker and a single track', () => {
    expect(parseSessionTopics('[Audio Tracks 008-009] Posture')[0]?.trackRange).toEqual({ start: 8, end: 9 });
    expect(parseSessionTopics('[Audio track 5] Posture')[0]?.trackRange).toEqual({ start: 5, end: 5 });
  });

  it('should leave a block without a marker untouched', () => {
    expect(parseSessionTopics('Main topics: A | B')).toEqual([{ text: 'Main topics: A | B', trackRange: null }]);
  });

  it('should return nothing for empty text', () => {
    expect(parseSessionTopics('  \n ')).toEqual([]);
    expect(parseSessionTopics(null)).toEqual([]);
  });
});

describe('getEventTopics', () => {
  it('should use the language of the app', () => {
    const topics = getEventTopics(
      { main_topics_translations: { en: 'Main', pt: 'Principal' }, session_topics_translations: { en: 'S', pt: 'Sessão' } },
      'pt',
    );
    expect(topics.main).toBe('Principal');
    expect(topics.sessions[0]?.text).toBe('Sessão');
  });

  it('should fall back to the other language, field by field', () => {
    const topics = getEventTopics(
      { main_topics_translations: { pt: 'Principal' }, session_topics_translations: { en: 'S' } },
      'en',
    );
    expect(topics.main).toBe('Principal');
    expect(topics.sessions[0]?.text).toBe('S');
  });

  it('should report no content for blank fields', () => {
    const topics = getEventTopics({ main_topics_translations: { en: ' ' }, session_topics_translations: {} }, 'en');
    expect(topics.hasContent).toBe(false);
  });

  it('should keep the line breaks of the main topics', () => {
    const topics = getEventTopics({ main_topics_translations: { en: 'A\n\nB' } }, 'en');
    expect(topics.main).toBe('A\n\nB');
    expect(topics.hasContent).toBe(true);
  });
});

describe('formatTrackRange', () => {
  it('should show one number for a single track', () => {
    expect(formatTrackRange({ start: 5, end: 5 })).toBe('5');
  });
  it('should show both ends otherwise', () => {
    expect(formatTrackRange({ start: 13, end: 24 })).toBe('13–24');
  });
});

describe('findTrackIndexByNumber', () => {
  it('should find the first track with that number', () => {
    expect(findTrackIndexByNumber([{ order: 1 }, { order: 7 }, { order: 7 }], 7)).toBe(1);
  });
  it('should return -1 when no track has that number', () => {
    expect(findTrackIndexByNumber([{ order: 1 }], 7)).toBe(-1);
  });
});

describe('the Topics tab', () => {
  const none = { hasVideo: false, hasAudio: false, hasDocuments: false };

  it('should open when it has content', () => {
    expect(resolveContentTab('topics', { ...none, hasAudio: true, hasTopics: true })).toBe('topics');
  });

  it('should fall back to another tab when it has no content', () => {
    expect(resolveContentTab('topics', { ...none, hasAudio: true, hasTopics: false })).toBe('tracks');
  });

  it('should be shown when topics are the only content', () => {
    expect(resolveContentTab('video', { ...none, hasTopics: true })).toBe('topics');
  });

  it('should not carry the inline player', () => {
    expect(shouldShowInlinePlayer({ ownsCurrentTrack: true, activeTab: 'topics' })).toBe(false);
  });
});
