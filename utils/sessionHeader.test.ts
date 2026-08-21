import { formatSessionHeader } from './sessionHeader';
import i18n from './i18n';

// Exercised against the real translation tables, not a stub — the bugs this
// guards against were both "the key lookup didn't resolve the way the call
// site assumed", which a stubbed t() would hide.
const t = (key: string, params?: Record<string, unknown>) => i18n.t(key, params);

const RETREAT_START = '2019-10-06';
const session = (over: Partial<Parameters<typeof formatSessionHeader>[0]> = {}) => ({
  sessionName: 'Session 1',
  sessionDate: '2019-10-06',
  sessionType: 'morning',
  sessionPartNumber: null,
  ...over,
});

describe('formatSessionHeader()', () => {
  describe('English', () => {
    beforeEach(async () => { await i18n.setLanguage('en'); });

    it('renders day, date and period', () => {
      expect(formatSessionHeader(session(), RETREAT_START, 'en', t))
        .toBe('Day 1 · October 6th · Morning');
    });

    it('counts days from the retreat start', () => {
      expect(formatSessionHeader(session({ sessionDate: '2019-10-08', sessionType: 'afternoon' }), RETREAT_START, 'en', t))
        .toBe('Day 3 · October 8th · Afternoon');
    });

    it('appends the part number when the session is split', () => {
      expect(formatSessionHeader(session({ sessionPartNumber: 2 }), RETREAT_START, 'en', t))
        .toBe('Day 1 · October 6th · Morning · Part 2');
    });
  });

  describe('Portuguese', () => {
    beforeEach(async () => { await i18n.setLanguage('pt'); });

    // The reported bug: everything but the period label was pinned to English.
    it('translates every segment', () => {
      expect(formatSessionHeader(session(), RETREAT_START, 'pt', t))
        .toBe('Dia 1 · 6 de outubro · Manhã');
    });

    it('translates the part number too', () => {
      expect(formatSessionHeader(session({ sessionPartNumber: 3 }), RETREAT_START, 'pt', t))
        .toBe('Dia 1 · 6 de outubro · Manhã · Parte 3');
    });

    it('never emits an English ordinal or month name', () => {
      for (const day of ['2019-10-01', '2019-10-02', '2019-10-03', '2019-10-11', '2019-10-21']) {
        const header = formatSessionHeader(session({ sessionDate: day }), RETREAT_START, 'pt', t);
        expect(header).not.toMatch(/\d(st|nd|rd|th)\b/);
        expect(header).not.toMatch(/October|Day |Morning/);
      }
    });
  });

  describe("sessions the API left without a time period", () => {
    let warn: jest.SpyInstance;
    beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(() => warn.mockRestore());

    // Production event 920 / session 1261: time_period is null, which
    // retreatService maps to 'other'. This used to render the untranslated
    // key — "DAY 2 · OCTOBER 7TH · RETREATS.OTHER".
    it("omits the period segment for 'other' instead of printing the key", async () => {
      await i18n.setLanguage('pt');
      const header = formatSessionHeader(
        session({ sessionDate: '2019-10-07', sessionType: 'other' }), RETREAT_START, 'pt', t,
      );
      expect(header).toBe('Dia 2 · 7 de outubro');
      expect(header).not.toMatch(/retreats\./i);
    });

    it('does not even attempt a lookup for it', async () => {
      await i18n.setLanguage('en');
      formatSessionHeader(session({ sessionType: 'other' }), RETREAT_START, 'en', t);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('degraded inputs', () => {
    beforeEach(async () => { await i18n.setLanguage('en'); });

    it('drops the day and date for an undated session', () => {
      expect(formatSessionHeader(session({ sessionDate: '' }), RETREAT_START, 'en', t))
        .toBe('Morning');
    });

    it('falls back to the session name when nothing else resolves', () => {
      expect(formatSessionHeader(
        session({ sessionDate: '', sessionType: 'other', sessionName: 'Opening talk' }), RETREAT_START, 'en', t,
      )).toBe('Opening talk');
    });

    it('returns an empty string when there is nothing at all to show', () => {
      expect(formatSessionHeader(
        session({ sessionDate: '', sessionType: 'other', sessionName: '' }), RETREAT_START, 'en', t,
      )).toBe('');
    });

    it('anchors the day counter to the session itself when the retreat start is missing', () => {
      expect(formatSessionHeader(session({ sessionDate: '2019-10-09' }), undefined, 'en', t))
        .toBe('Day 1 · October 9th · Morning');
    });

    it('ignores an unparseable retreat start date', () => {
      expect(formatSessionHeader(session(), 'nonsense', 'en', t))
        .toBe('October 6th · Morning');
    });
  });
});
