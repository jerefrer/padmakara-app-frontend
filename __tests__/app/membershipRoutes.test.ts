import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('membership routes live inside the app frame', () => {
  it.each(['_layout', 'index', 'confirming', 'closed', 'terms', 'pay'])(
    'should keep the %s screen under app/(tabs)/membership and not under app/membership',
    (name) => {
      expect(fs.existsSync(path.join(root, `app/(tabs)/membership/${name}.tsx`))).toBe(true);
      expect(fs.existsSync(path.join(root, `app/membership/${name}.tsx`))).toBe(false);
    },
  );

  it('should register membership as a hidden tab in the tabs layout', () => {
    const layout = read('app/(tabs)/_layout.tsx');
    expect(layout).toMatch(/name="membership"\s+options=\{\{\s*href: null,/);
  });

  it('should pop the membership stack to its root when the hidden tab loses focus', () => {
    const layout = read('app/(tabs)/_layout.tsx');
    expect(layout).toMatch(/name="membership"\s+options=\{\{[^}]*popToTopOnBlur: true/);
  });

  it('should start the membership stack at index so a reload on pay can go back', () => {
    expect(read('app/(tabs)/membership/_layout.tsx')).toMatch(
      /unstable_settings\s*=\s*\{\s*initialRouteName: 'index',?\s*\}/,
    );
  });

  it('should not register membership as a root stack screen', () => {
    expect(read('app/_layout.tsx')).not.toMatch(/name="membership"/);
  });

  it('should keep the membership layout a headerless Stack', () => {
    expect(read('app/(tabs)/membership/_layout.tsx')).toMatch(/headerShown: false/);
  });

  it('should keep the legacy subscription redirect pointing at /membership', () => {
    expect(read('app/subscription/[...rest].tsx')).toContain('href="/membership"');
  });
});
