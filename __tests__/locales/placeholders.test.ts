import en from '../../locales/en.json';
import pt from '../../locales/pt.json';

function strings(node: unknown, path: string[] = []): [string, string][] {
  if (typeof node === 'string') return [[path.join('.'), node]];
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => strings(value, [...path, key]));
  }
  return [];
}

// t() only fills {{name}}; a lone {name} is shown to people as is.
const SINGLE_BRACE = /(^|[^{])\{[A-Za-z]\w*\}(?!\})/;
// Older strings whose callers fill {name} themselves with .replace().
const FILLED_BY_CALLER = new Set([
  'storage.publicationsCacheInfo',
  'publications.pageCount',
  'publications.newVersion.label',
]);

describe('locale placeholders', () => {
  it.each([
    ['en', en],
    ['pt', pt],
  ])('should only use {{name}} placeholders in %s', (_lang, messages) => {
    const offenders = strings(messages).filter(
      ([key, text]) => !FILLED_BY_CALLER.has(key) && SINGLE_BRACE.test(text),
    );

    expect(offenders).toEqual([]);
  });
});
