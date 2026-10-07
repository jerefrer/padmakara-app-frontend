import en from '../../locales/en.json';
import pt from '../../locales/pt.json';

function strings(tree: unknown): string[] {
  if (typeof tree === 'string') return [tree];
  if (tree && typeof tree === 'object') return Object.values(tree).flatMap(strings);
  return [];
}

describe('membership vocabulary', () => {
  it.each([
    ['en', en],
    ['pt', pt],
  ])('should never use the word subscription in the %s membership namespace', (_name, locale) => {
    const all = strings((locale as any).membership);
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((s) => /subscri|assinatura/i.test(s))).toEqual([]);
  });
});
