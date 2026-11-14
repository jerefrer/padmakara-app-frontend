import { flattenPdfOutline } from '@/utils/pdfOutline';

describe('flattenPdfOutline', () => {
  it('should turn the native table of contents into 1-based pages with depths', () => {
    const toc = [
      {
        title: 'Day one',
        pageIdx: 2,
        children: [
          { title: 'Morning', pageIdx: '3', children: [] },
          { title: 'Evening', pageIdx: 9, children: [{ title: 'Questions', pageIdx: 11, children: [] }] },
        ],
      },
      { title: 'Day two', pageIdx: '14', children: [] },
    ];

    expect(flattenPdfOutline(toc)).toEqual([
      { title: 'Day one', page: 3, depth: 0 },
      { title: 'Morning', page: 4, depth: 1 },
      { title: 'Evening', page: 10, depth: 1 },
      { title: 'Questions', page: 12, depth: 2 },
      { title: 'Day two', page: 15, depth: 0 },
    ]);
  });

  it('should return an empty list when the document has no outline', () => {
    expect(flattenPdfOutline(undefined)).toEqual([]);
    expect(flattenPdfOutline([])).toEqual([]);
    expect(flattenPdfOutline('')).toEqual([]);
  });

  it('should skip entries without a title or a usable page', () => {
    const toc = [
      { title: '  ', pageIdx: 1, children: [] },
      { title: 'Broken', pageIdx: 'x', children: [{ title: 'Child', pageIdx: 4, children: [] }] },
      { title: 'Ok', pageIdx: 0 },
    ];

    expect(flattenPdfOutline(toc)).toEqual([
      { title: 'Child', page: 5, depth: 1 },
      { title: 'Ok', page: 1, depth: 0 },
    ]);
  });

  it('should trim titles', () => {
    expect(flattenPdfOutline([{ title: ' Prologue \n', pageIdx: 0 }])).toEqual([
      { title: 'Prologue', page: 1, depth: 0 },
    ]);
  });
});
