import fs from 'fs';
import path from 'path';

import en from './en.json';
import pt from './pt.json';

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'contexts', 'hooks', 'services', 'utils'];

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = `${prefix}${k}`;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, `${key}.`));
  }
  return out;
}

const EN = flatten(en as Tree);
const PT = flatten(pt as Tree);

/** Drop comments so that a `t('...')` written in prose (or commented out)
 *  isn't mistaken for a real call site. Line-comment stripping is done per
 *  line rather than by regex so that "https://..." inside a string is safe. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*');
    })
    .join('\n');
}

function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d));
  return files;
}

describe('locale files', () => {
  it('en and pt define exactly the same keys', () => {
    expect(Object.keys(PT).sort()).toEqual(Object.keys(EN).sort());
  });

  it('has no empty translation values', () => {
    const empty = [...Object.entries(EN), ...Object.entries(PT)]
      .filter(([, v]) => v.trim() === '')
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });

  // retreatService.normalizeSessionType() guarantees Session['type'] only ever
  // holds one of these or 'other'. 'other' is deliberately unlabelled — the
  // session header omits the segment rather than printing a placeholder.
  it('labels every session time period the UI can render', () => {
    for (const period of ['morning', 'afternoon', 'evening', 'full_day']) {
      expect(EN[`retreats.${period}`]).toBeTruthy();
      expect(PT[`retreats.${period}`]).toBeTruthy();
    }
    expect(EN['retreats.other']).toBeUndefined();
  });

  it('keeps interpolation placeholders consistent between languages', () => {
    const placeholders = (s: string) => (s.match(/\{\{(\w+)\}\}/g) ?? []).sort();
    const mismatched = Object.keys(EN).filter(
      (k) => placeholders(EN[k]).join() !== placeholders(PT[k]).join(),
    );
    expect(mismatched).toEqual([]);
  });
});

describe('t() call sites', () => {
  // A missing key resolves to '' (see utils/i18n.ts), so a typo silently blanks
  // the UI instead of throwing. This test is the safety net for that.
  it('every statically-written t() key exists in both locale files', () => {
    const call = /\bt\(\s*['"]([a-zA-Z][\w.]*)['"]/g;
    const missing: string[] = [];

    for (const file of sourceFiles()) {
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      for (const m of src.matchAll(call)) {
        const key = m[1];
        if (!(key in EN) || !(key in PT)) {
          missing.push(`${path.relative(ROOT, file)} → ${key}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('finds a meaningful number of call sites (guards against a broken scan)', () => {
    const total = sourceFiles()
      .map((f) => (stripComments(fs.readFileSync(f, 'utf8')).match(/\bt\(\s*['"][a-zA-Z]/g) ?? []).length)
      .reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(200);
  });
});
