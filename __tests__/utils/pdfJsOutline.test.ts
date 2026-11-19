import { resolvePdfJsOutline, type PdfJsOutlineSource } from '@/utils/pdfOutline';

/** A pdf.js document whose page references are `{ num }` objects (page index = num). */
function pdfWith(outline: unknown, named: Record<string, unknown> = {}, numPages = 40): PdfJsOutlineSource {
  return {
    numPages,
    getOutline: () => Promise.resolve(outline),
    getDestination: (id: string) => Promise.resolve(named[id] ?? null),
    getPageIndex: (ref: unknown) => Promise.resolve((ref as { num: number }).num),
  };
}

describe('resolvePdfJsOutline', () => {
  it('should resolve explicit and named destinations to 1-based pages, keeping the order and depth', async () => {
    const pdf = pdfWith(
      [
        {
          title: 'Day one',
          dest: [{ num: 2 }, { name: 'XYZ' }],
          items: [{ title: 'Morning', dest: 'morning', items: [] }],
        },
        { title: 'Day two', dest: [14, { name: 'Fit' }], items: [] },
      ],
      { morning: [{ num: 3 }, { name: 'XYZ' }] },
    );

    expect(await resolvePdfJsOutline(pdf)).toEqual([
      { title: 'Day one', page: 3, depth: 0 },
      { title: 'Morning', page: 4, depth: 1 },
      { title: 'Day two', page: 15, depth: 0 },
    ]);
  });

  it('should drop entries without a usable page and keep their children', async () => {
    const pdf = pdfWith(
      [
        { title: 'Broken', dest: 'missing', items: [{ title: 'Kept', dest: [{ num: 5 }], items: [] }] },
        { title: 'Beyond the end', dest: [{ num: 99 }], items: [] },
        { title: '  ', dest: [{ num: 1 }], items: [] },
      ],
      {},
      40,
    );

    expect(await resolvePdfJsOutline(pdf)).toEqual([{ title: 'Kept', page: 6, depth: 1 }]);
  });

  it('should answer an empty outline for a document without one or a broken one', async () => {
    expect(await resolvePdfJsOutline(pdfWith(null))).toEqual([]);

    const broken = { ...pdfWith([]), getOutline: () => Promise.reject(new Error('bad xref')) };
    expect(await resolvePdfJsOutline(broken)).toEqual([]);
  });
});
