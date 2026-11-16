import en from '../../locales/en.json';
import pt from '../../locales/pt.json';

describe('device storage error locale keys', () => {
  it('should define the sign-in device error in English and Portuguese', () => {
    expect((en as any).auth.signInPanel.deviceStorage).toEqual(expect.any(String));
    expect((pt as any).auth.signInPanel.deviceStorage).toEqual(expect.any(String));
    expect((pt as any).auth.signInPanel.deviceStorage).not.toBe((en as any).auth.signInPanel.deviceStorage);
  });

  it('should never use the word subscription', () => {
    const all = [(en as any).auth.signInPanel.deviceStorage, (pt as any).auth.signInPanel.deviceStorage];
    expect(all.filter((s) => /subscri|assinatura/i.test(String(s)))).toEqual([]);
  });
});
