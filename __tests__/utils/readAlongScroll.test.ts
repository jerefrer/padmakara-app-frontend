import { readingScrollTarget } from '@/utils/readAlongScroll';

const view = { scrollY: 1000, viewportHeight: 600 };

describe('readingScrollTarget', () => {
  it('should leave the text alone while the word is in the comfortable band', () => {
    expect(readingScrollTarget({ ...view, wordY: 1200, wordHeight: 30 })).toBeNull();
  });

  it('should bring a word that ran below the band up to the reading line', () => {
    expect(readingScrollTarget({ ...view, wordY: 1500, wordHeight: 30 })).toBe(1500 - 600 * 0.35);
  });

  it('should bring a word above the view back down to the reading line', () => {
    expect(readingScrollTarget({ ...view, wordY: 400, wordHeight: 30 })).toBe(400 - 600 * 0.35);
  });

  it('should recenter even inside the band when forced', () => {
    expect(readingScrollTarget({ ...view, wordY: 1200, wordHeight: 30, force: true })).toBe(1200 - 210);
  });

  it('should never scroll above the top of the text', () => {
    expect(readingScrollTarget({ scrollY: 500, viewportHeight: 600, wordY: 40, wordHeight: 30 })).toBe(0);
  });

  it('should do nothing before the viewport is measured', () => {
    expect(readingScrollTarget({ scrollY: 0, viewportHeight: 0, wordY: 900, wordHeight: 30, force: true })).toBeNull();
  });
});
