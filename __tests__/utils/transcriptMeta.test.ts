import { pickTranscript, transcriptTags, normalizeTranscriptStatus } from '@/utils/transcriptMeta';

describe('normalizeTranscriptStatus', () => {
  it('should keep a known status', () => {
    expect(normalizeTranscriptStatus('provisional')).toBe('provisional');
  });

  it('should treat a missing or unknown status as final', () => {
    expect(normalizeTranscriptStatus(undefined)).toBe('final');
    expect(normalizeTranscriptStatus('published')).toBe('final');
  });
});

describe('transcriptTags', () => {
  it('should show nothing for a final, full transcript', () => {
    expect(transcriptTags({ status: 'final', isExcerpt: false })).toEqual([]);
  });

  it('should show the status of a provisional, unrevised or draft transcript', () => {
    expect(transcriptTags({ status: 'provisional' })).toEqual(['provisional']);
    expect(transcriptTags({ status: 'unrevised' })).toEqual(['unrevised']);
    expect(transcriptTags({ status: 'draft' })).toEqual(['draft']);
  });

  it('should show excerpts after the status', () => {
    expect(transcriptTags({ status: 'provisional', isExcerpt: true })).toEqual(['provisional', 'excerpts']);
    expect(transcriptTags({ status: 'final', isExcerpt: true })).toEqual(['excerpts']);
  });
});

describe('pickTranscript', () => {
  it('should prefer the final transcript among those in the UI language', () => {
    const rows = [
      { id: 1, language: 'pt', status: 'provisional' },
      { id: 2, language: 'pt', status: 'final' },
      { id: 3, language: 'en', status: 'final' },
    ];
    expect(pickTranscript(rows, 'pt')?.id).toBe(2);
  });

  it('should take a non-final transcript in the UI language over one in another language', () => {
    const rows = [
      { id: 3, language: 'en', status: 'final' },
      { id: 1, language: 'pt', status: 'draft' },
    ];
    expect(pickTranscript(rows, 'pt')?.id).toBe(1);
  });

  it('should count a row without a status as final', () => {
    const rows = [
      { id: 1, language: 'en', status: 'unrevised' },
      { id: 2, language: 'en' },
    ];
    expect(pickTranscript(rows, 'en')?.id).toBe(2);
  });

  it('should fall back to the first transcript when none is in the UI language', () => {
    const rows = [
      { id: 5, language: 'fr', status: 'final' },
      { id: 6, language: 'tib', status: 'final' },
    ];
    expect(pickTranscript(rows, 'pt')?.id).toBe(5);
  });

  it('should return undefined when the event has no transcript', () => {
    expect(pickTranscript([], 'en')).toBeUndefined();
  });
});
