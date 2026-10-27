import en from '../../locales/en.json';
import pt from '../../locales/pt.json';

describe('account deletion page locale keys', () => {
  it('should define the same keys in English and Portuguese', () => {
    const enKeys = Object.keys((en as any).accountDeletionPage).sort();
    const ptKeys = Object.keys((pt as any).accountDeletionPage).sort();
    expect(enKeys.length).toBeGreaterThan(0);
    expect(ptKeys).toEqual(enKeys);
  });

  it('should never use the word subscription on the page', () => {
    const all = [...Object.values((en as any).accountDeletionPage), ...Object.values((pt as any).accountDeletionPage)];
    expect(all.filter((s) => /subscri|assinatura|subscri[cç]/i.test(String(s)))).toEqual([]);
  });
});
