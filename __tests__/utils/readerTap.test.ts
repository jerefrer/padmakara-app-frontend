import { isPageTap, TAP_SLOP_PX } from '@/utils/readerTap';

const plain = { closest: () => null };
const base = { target: plain, down: { x: 100, y: 100 }, up: { x: 100, y: 100 }, selectedText: '', modified: false };

describe('isPageTap', () => {
  it('should count a click on the page text as a tap', () => {
    expect(isPageTap(base)).toBe(true);
  });

  it('should leave a click on a PDF link to the link', () => {
    expect(isPageTap({ ...base, target: { closest: () => ({}) } })).toBe(false);
  });

  it('should not count a drag that panned the page', () => {
    expect(isPageTap({ ...base, up: { x: 100, y: 100 + TAP_SLOP_PX + 1 } })).toBe(false);
  });

  it('should count a tiny jitter between press and release as a tap', () => {
    expect(isPageTap({ ...base, up: { x: 102, y: 101 } })).toBe(true);
  });

  it('should not count the end of a text selection', () => {
    expect(isPageTap({ ...base, selectedText: 'tathagata' })).toBe(false);
  });

  it('should ignore a selection of only whitespace', () => {
    expect(isPageTap({ ...base, selectedText: '  \n' })).toBe(true);
  });

  it('should not count a modified click', () => {
    expect(isPageTap({ ...base, modified: true })).toBe(false);
  });

  it('should count a click with no recorded press, such as a keyboard-triggered one', () => {
    expect(isPageTap({ ...base, down: null })).toBe(true);
  });
});
