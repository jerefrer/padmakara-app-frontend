import fs from 'fs';
import path from 'path';

/**
 * EB Garamond and Minion Pro are loaded as separate font files
 * (EBGaramond_600SemiBold, MinionPro_Semibold, ...).
 * On the web each file becomes its own font family with normal weight, so a
 * style that sets a bold FILE and also a fontWeight makes the browser add a
 * synthetic bold on top of an already bold face (fuzzy, heavy text). Native
 * ignores fontWeight with a custom file, so the bug is invisible on phones.
 * The weight must come from the font file alone.
 */

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'components'];
const SKIP_DIRS = new Set(['node_modules', '__tests__', '__mocks__']);

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectSourceFiles(path.join(dir, entry.name), out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

interface StyleBlock {
  name: string;
  line: number;
  body: string;
}

/** Returns every top-level style block of every StyleSheet.create({ ... }) call. */
function extractStyleBlocks(source: string): StyleBlock[] {
  const blocks: StyleBlock[] = [];
  let from = 0;
  for (;;) {
    const call = source.indexOf('StyleSheet.create(', from);
    if (call === -1) break;
    const open = source.indexOf('{', call);
    let depth = 0;
    let blockStart = -1;
    let blockName = '';
    let i = open;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === '{') {
        depth++;
        if (depth === 2) {
          blockStart = i;
          const before = source.slice(0, i);
          const m = /([A-Za-z_$][\w$]*|'[^']+'|"[^"]+")\s*:\s*$/.exec(before);
          blockName = m ? m[1] : '?';
        }
      } else if (ch === '}') {
        if (depth === 2) {
          blocks.push({
            name: blockName,
            line: source.slice(0, blockStart).split('\n').length,
            body: source.slice(blockStart, i + 1),
          });
        }
        depth--;
        if (depth === 0) break;
      }
    }
    from = i + 1;
  }
  return blocks;
}

function fauxBoldStyles(): string[] {
  const offenders: string[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of collectSourceFiles(path.join(ROOT, dir))) {
      const source = fs.readFileSync(file, 'utf8');
      for (const block of extractStyleBlocks(source)) {
        // `fonts.display` (components/membership/theme.ts) is EBGaramond_600SemiBold.
        const family = /fontFamily:\s*(?:['"](EBGaramond_[A-Za-z0-9]+|MinionPro(?:_[A-Za-z]+)?)['"]|(fonts\.display))/.exec(block.body);
        const weight = /fontWeight:\s*['"]?(\w+)['"]?/.exec(block.body);
        if (family && weight && weight[1] !== 'normal' && weight[1] !== '400') {
          offenders.push(
            `${path.relative(ROOT, file)}:${block.line} ${block.name} (${family[1] ?? family[2]} + fontWeight ${weight[1]})`,
          );
        }
      }
    }
  }
  return offenders;
}

describe('EB Garamond and Minion Pro font files', () => {
  it('should never combine a font file with a non-normal fontWeight in a StyleSheet style', () => {
    expect(fauxBoldStyles()).toEqual([]);
  });

  it('should detect a faux bold style in a synthetic source', () => {
    const blocks = extractStyleBlocks(
      "const s = StyleSheet.create({\n a: { fontFamily: 'EBGaramond_700Bold', fontWeight: 'bold' },\n b: { fontSize: 1 },\n});",
    );
    expect(blocks.map((b) => b.name)).toEqual(['a', 'b']);
    expect(blocks[0].body).toMatch(/fontWeight/);
  });
});
