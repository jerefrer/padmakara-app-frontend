import en from '../../locales/en.json';
import pt from '../../locales/pt.json';

function keys(tree: unknown, prefix = ''): string[] {
  if (!tree || typeof tree !== 'object') return [];
  return Object.entries(tree).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('membership locale keys', () => {
  it('should define the same membership keys in English and Portuguese', () => {
    const enKeys = keys((en as any).membership).sort();
    const ptKeys = keys((pt as any).membership).sort();
    expect(ptKeys).toEqual(enKeys);
  });

  it('should not carry the unused managePlaceholder key', () => {
    expect((en as any).membership.managePlaceholder).toBeUndefined();
    expect((pt as any).membership.managePlaceholder).toBeUndefined();
  });
});
