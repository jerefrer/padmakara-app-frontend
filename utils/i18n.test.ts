import i18n from './i18n';

describe('i18n.t()', () => {
  beforeEach(async () => {
    await i18n.setLanguage('en');
  });

  it('resolves a nested key', () => {
    expect(i18n.t('common.cancel')).toBe('Cancel');
  });

  it('follows the selected language', async () => {
    await i18n.setLanguage('pt');
    expect(i18n.t('common.cancel')).toBe('Cancelar');
  });

  it('interpolates {{params}}', () => {
    expect(i18n.t('retreats.dayNumber', { n: 3 })).toBe('Day 3');
  });

  it('leaves an unsupplied placeholder untouched', () => {
    expect(i18n.t('retreats.dayNumber', {})).toBe('Day {{n}}');
  });

  // The regression this contract exists for: t() used to return the key on a
  // miss. The key is truthy, so `t('retreats.other') || fallback` rendered the
  // literal string "retreats.other" to the user instead of the fallback.
  describe('on a missing key', () => {
    let warn: jest.SpyInstance;
    beforeEach(() => {
      warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => warn.mockRestore());

    it('returns an empty string, never the key', () => {
      expect(i18n.t('retreats.definitelyNotAKey')).toBe('');
    });

    it('lets the `|| fallback` idiom engage', () => {
      expect(i18n.t('retreats.definitelyNotAKey') || 'Fallback').toBe('Fallback');
    });

    it('returns an empty string for a partially-valid path', () => {
      expect(i18n.t('common')).toBe('');
      expect(i18n.t('common.cancel.deeper')).toBe('');
    });

    it('warns so the miss is visible in development', () => {
      i18n.t('retreats.definitelyNotAKey');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('retreats.definitelyNotAKey'),
      );
    });
  });
});
