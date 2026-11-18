"""
Rebuilds assets/images/brand-panel-logo.svg from the pdftocairo SVG of the
logo EPS:
  gs -dEPSCrop -sDEVICE=pdfwrite -o logo.pdf logo-padmakara-branco-2026.eps
  pdftocairo -svg logo.pdf logo.svg
  python3 scripts/flatten-logo-svg.py logo.svg assets/images/brand-panel-logo.svg
Drops the dark background, inlines the wordmark glyphs, crops to the artwork
and writes one white path on a 1000-unit grid with relative commands.
"""
import re, sys
src, out = sys.argv[1], sys.argv[2]
s = open(src).read()
defs = s[:s.index('</defs>')]
body = s[s.index('</defs>'):]
glyphs = {m.group(1): m.group(2) for m in re.finditer(r'<g id="(glyph-[^"]+)">\s*<path[^>]*?d="([^"]*)"', defs)}
num = r'-?\d+(?:\.\d+)?(?:e-?\d+)?'
def parse(d):
    toks = re.findall(r'[MLCZ]|' + num, d)
    cmds, i = [], 0
    while i < len(toks):
        c = toks[i]; i += 1
        n = {'M': 2, 'L': 2, 'C': 6, 'Z': 0}[c]
        cmds.append((c, [float(t) for t in toks[i:i + n]])); i += n
    return cmds
shapes = []  # list of command lists in page coordinates
for m in re.finditer(r'<(path|use)\b([^>]*)/?>', body):
    tag, attrs = m.groups()
    fill = re.search(r'fill="([^"]*)"', attrs)
    if tag == 'path':
        if fill and fill.group(1) != 'rgb(100%, 100%, 100%)':
            continue  # the dark background rectangle
        shapes.append(parse(re.search(r' d="([^"]*)"', attrs).group(1)))
    else:
        ref = re.search(r'xlink:href="#([^"]*)"', attrs).group(1)
        x = float(re.search(r' x="([^"]*)"', attrs).group(1)); y = float(re.search(r' y="([^"]*)"', attrs).group(1))
        shapes.append([(c, [v + (x if k % 2 == 0 else y) for k, v in enumerate(a)]) for c, a in parse(glyphs[ref])])
xs = [v for sh in shapes for c, a in sh for v in a[0::2]]
ys = [v for sh in shapes for c, a in sh for v in a[1::2]]
x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
w, h = x1 - x0, y1 - y0
# Scale to a 1000-unit-wide box and round to integers: about 0.15 px at 147 px wide, invisible.
k = 1000 / w
def fmt(v): return str(int(round(v)))
parts = []
# Relative commands on an integer grid: rounding absolute points first keeps
# the deltas exact, so errors never accumulate along a path.
cx = cy = 0
for sh in shapes:
    for c, a in sh:
        pts = [round((v - x0) * k) if i % 2 == 0 else round((v - y0) * k) for i, v in enumerate(a)]
        if c == 'Z':
            parts.append('z'); cx, cy = sx, sy; continue
        if c == 'M':
            parts.append('M' + str(pts[0]) + ' ' + str(pts[1])); cx, cy = pts[0], pts[1]; sx, sy = cx, cy; continue
        rel = []
        for i in range(0, len(pts), 2):
            rel += [pts[i] - cx, pts[i + 1] - cy]
        parts.append(c.lower() + ' '.join(str(v) for v in rel))
        cx, cy = pts[-2], pts[-1]
    # after z the current point returns to the subpath start
d = ''.join(parts)
d = re.sub(r' -', '-', d)
W, H = 1000, round(h * k)
open(out, 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><path fill="#fff" d="{d}"/></svg>\n')
print('bbox', round(w, 2), round(h, 2), 'aspect', round(w / h, 4), 'viewBox', W, H, 'shapes', len(shapes), 'bytes', len(open(out).read()))
