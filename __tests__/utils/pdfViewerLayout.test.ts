import {
  CSS_PX_PER_POINT,
  MAX_SCALE,
  MIN_SCALE,
  anchoredScroll,
  buildSpreads,
  fitScale,
  parseFitPreset,
  parseViewMode,
  pinchScale,
  resolveScale,
  rowAtMiddle,
  rowOffsets,
  spreadIndexOfPage,
  stepScale,
  swipeDirection,
  viewerKeyAction,
  visibleRows,
} from '@/utils/pdfViewerLayout';

const A4 = { width: 595, height: 842 };

describe('parseViewMode', () => {
  it('should keep a stored mode', () => {
    expect(parseViewMode('two')).toBe('two');
    expect(parseViewMode('single')).toBe('single');
  });

  it('should default to continuous when nothing is stored', () => {
    expect(parseViewMode(null)).toBe('continuous');
  });

  it('should read the former two-page layouts as two pages', () => {
    expect(parseViewMode(null, 'spread-cover')).toBe('two');
    expect(parseViewMode(null, 'spread')).toBe('two');
  });

  it('should read the former single layout, a scrolled column, as continuous', () => {
    expect(parseViewMode(null, 'single')).toBe('continuous');
  });
});

describe('parseFitPreset', () => {
  it('should read the former width and height values', () => {
    expect(parseFitPreset('width')).toBe('fit-width');
    expect(parseFitPreset('height')).toBe('fit-page');
  });

  it('should default to fit page', () => {
    expect(parseFitPreset(null)).toBe('fit-page');
  });
});

describe('buildSpreads', () => {
  it('should put one page per row in continuous and single modes', () => {
    expect(buildSpreads('continuous', 3)).toEqual([[1], [2], [3]]);
    expect(buildSpreads('single', 2)).toEqual([[1], [2]]);
  });

  it('should show the cover alone then facing pairs in two-page mode', () => {
    expect(buildSpreads('two', 6)).toEqual([[1], [2, 3], [4, 5], [6]]);
    expect(buildSpreads('two', 5)).toEqual([[1], [2, 3], [4, 5]]);
  });

  it('should return no rows before the document is loaded', () => {
    expect(buildSpreads('two', 0)).toEqual([]);
  });
});

describe('spreadIndexOfPage', () => {
  const spreads = buildSpreads('two', 6);

  it('should find the spread holding a page', () => {
    expect(spreadIndexOfPage(spreads, 1)).toBe(0);
    expect(spreadIndexOfPage(spreads, 3)).toBe(1);
    expect(spreadIndexOfPage(spreads, 6)).toBe(3);
  });

  it('should clamp a page outside the document', () => {
    expect(spreadIndexOfPage(spreads, 0)).toBe(0);
    expect(spreadIndexOfPage(spreads, 99)).toBe(3);
  });
});

describe('zoom steps', () => {
  it('should step to the next preset above and below', () => {
    expect(stepScale(1, 1)).toBe(1.1);
    expect(stepScale(1, -1)).toBe(0.9);
  });

  it('should step from a scale between presets to the nearest one', () => {
    expect(stepScale(1.03, 1)).toBe(1.1);
    expect(stepScale(1.03, -1)).toBe(1);
  });

  it('should stop at the limits', () => {
    expect(stepScale(MAX_SCALE, 1)).toBe(MAX_SCALE);
    expect(stepScale(MIN_SCALE, -1)).toBe(MIN_SCALE);
  });
});

describe('pinchScale', () => {
  it('should zoom in when the fingers spread (negative deltaY)', () => {
    expect(pinchScale(1, -10)).toBeGreaterThan(1);
  });

  it('should zoom out when the fingers close', () => {
    expect(pinchScale(1, 10)).toBeLessThan(1);
  });

  it('should stay within the scale limits', () => {
    expect(pinchScale(MAX_SCALE, -500)).toBe(MAX_SCALE);
    expect(pinchScale(MIN_SCALE, 500)).toBe(MIN_SCALE);
  });
});

describe('fitScale', () => {
  const viewport = { width: 1000, height: 600 };

  it('should fill the width with one page for fit width', () => {
    expect(fitScale('fit-width', [A4], viewport, 16) * A4.width * CSS_PX_PER_POINT).toBeCloseTo(1000);
  });

  it('should fit the whole page within the height for fit page', () => {
    expect(fitScale('fit-page', [A4], viewport, 16) * A4.height * CSS_PX_PER_POINT).toBeCloseTo(600);
  });

  it('should share the width between two pages and their gap', () => {
    const scale = fitScale('fit-width', [A4, A4], viewport, 16);
    expect(2 * A4.width * CSS_PX_PER_POINT * scale + 16).toBeCloseTo(1000);
  });

  it('should limit fit page by the width when the spread is wide', () => {
    const narrow = { width: 500, height: 2000 };
    expect(fitScale('fit-page', [A4, A4], narrow, 16)).toBeCloseTo(fitScale('fit-width', [A4, A4], narrow, 16));
  });

  it('should use a free scale as is, clamped', () => {
    expect(resolveScale({ kind: 'scale', scale: 1.5 }, [A4], viewport, 16)).toBe(1.5);
    expect(resolveScale({ kind: 'scale', scale: 50 }, [A4], viewport, 16)).toBe(MAX_SCALE);
  });
});

describe('continuous column', () => {
  const heights = [100, 100, 100, 100, 100];
  const { offsets, total } = rowOffsets(heights, 10);

  it('should place rows one after the other with a gap', () => {
    expect(offsets).toEqual([0, 110, 220, 330, 440]);
    expect(total).toBe(540);
  });

  it('should render only the rows in view plus the overscan', () => {
    expect(visibleRows(offsets, heights, 230, 100, 0)).toEqual({ first: 2, last: 3 });
    expect(visibleRows(offsets, heights, 230, 100, 1)).toEqual({ first: 1, last: 4 });
  });

  it('should report the row under the middle of the view as current', () => {
    expect(rowAtMiddle(offsets, heights, 0, 100)).toBe(0);
    expect(rowAtMiddle(offsets, heights, 300, 100)).toBe(3);
    expect(rowAtMiddle(offsets, heights, 9999, 100)).toBe(4);
  });
});

describe('anchoredScroll', () => {
  it('should keep the point under the pointer in place when zooming', () => {
    // Point at content y = 300 (scroll 200 + pointer 100); doubled it is 600.
    expect(anchoredScroll(200, 100, 2)).toBe(500);
  });

  it('should never scroll before the start', () => {
    expect(anchoredScroll(0, 100, 0.5)).toBe(0);
  });
});

describe('viewerKeyAction', () => {
  it('should zoom with Cmd or Ctrl and + - 0 in every mode', () => {
    expect(viewerKeyAction({ key: '=', metaKey: true }, 'continuous', true)).toBe('zoom-in');
    expect(viewerKeyAction({ key: '+', ctrlKey: true, shiftKey: true }, 'single', false)).toBe('zoom-in');
    expect(viewerKeyAction({ key: '-', ctrlKey: true }, 'two', false)).toBe('zoom-out');
    expect(viewerKeyAction({ key: '0', metaKey: true }, 'continuous', true)).toBe('zoom-reset');
  });

  it('should leave other Cmd shortcuts to the browser', () => {
    expect(viewerKeyAction({ key: 'k', metaKey: true }, 'single', false)).toBeNull();
    expect(viewerKeyAction({ key: 'ArrowRight', metaKey: true }, 'single', false)).toBeNull();
  });

  it('should turn pages with arrows and page keys in paged modes', () => {
    expect(viewerKeyAction({ key: 'ArrowRight' }, 'single', false)).toBe('next');
    expect(viewerKeyAction({ key: 'PageUp' }, 'two', false)).toBe('previous');
    expect(viewerKeyAction({ key: 'Home' }, 'two', false)).toBe('first');
    expect(viewerKeyAction({ key: 'End' }, 'single', false)).toBe('last');
  });

  it('should let up and down scroll a page zoomed taller than the view', () => {
    expect(viewerKeyAction({ key: 'ArrowDown' }, 'single', true)).toBeNull();
    expect(viewerKeyAction({ key: 'ArrowDown' }, 'single', false)).toBe('next');
  });

  it('should leave page keys to native scrolling in continuous mode', () => {
    expect(viewerKeyAction({ key: 'ArrowRight' }, 'continuous', false)).toBeNull();
    expect(viewerKeyAction({ key: 'PageDown' }, 'continuous', true)).toBeNull();
  });
});

describe('swipeDirection', () => {
  it('should turn to the next page on a left swipe', () => {
    expect(swipeDirection(-80, 5)).toBe(1);
  });

  it('should turn back on a right swipe', () => {
    expect(swipeDirection(80, 5)).toBe(-1);
  });

  it('should ignore short or mostly vertical moves', () => {
    expect(swipeDirection(-20, 0)).toBe(0);
    expect(swipeDirection(-80, 120)).toBe(0);
  });
});
