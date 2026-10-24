import { focalCoverPlacement, focalCoverPosition, focalCoverTransform } from '../../utils/focalCover';

/**
 * Reference vectors for the admin preview (copy these as-is). Values are the
 * object-position percentages passed to expo-image `contentPosition`:
 *
 *   frame 390x244,  image 1200x1800, focal (50, 25) -> left 50%, top 7.11%
 *   frame 390x380,  image 2400x1350, focal (30, 50) -> left 2.68%, top 50%
 *   frame 900x380,  image 2400x1350, focal (50, 90) -> left 50%, top 100%
 */
const pct = (s: string) => parseFloat(s.replace('%', ''));

type Case = {
  name: string;
  input: Parameters<typeof focalCoverPosition>[0];
  left: number;
  top: number;
};

const cases: Case[] = [
  {
    name: 'should return 50%/50% when the focal point is the image centre',
    input: { frameWidth: 300, frameHeight: 300, imageWidth: 2000, imageHeight: 1000, focalX: 50, focalY: 50 },
    left: 50,
    top: 50,
  },
  {
    name: 'should return left 0% when a wide image has its focal point on the left edge in a square frame',
    input: { frameWidth: 300, frameHeight: 300, imageWidth: 2000, imageHeight: 1000, focalX: 0, focalY: 50 },
    left: 0,
    top: 50,
  },
  {
    name: 'should return top 100% when the focal point is at the bottom of a tall image',
    input: { frameWidth: 400, frameHeight: 200, imageWidth: 1000, imageHeight: 2000, focalX: 50, focalY: 100 },
    left: 50,
    top: 100,
  },
  {
    name: 'should return 50%/50% when the image has the frame aspect ratio',
    input: { frameWidth: 320, frameHeight: 200, imageWidth: 1600, imageHeight: 1000, focalX: 10, focalY: 90 },
    left: 50,
    top: 50,
  },
  {
    // dw = 400, dh = 600; desired oy = 100 - 150 = -50; top = 50 / 400 = 12.5%
    name: 'should place a portrait face at 25% height well below 25% in a 2:1 frame',
    input: { frameWidth: 400, frameHeight: 200, imageWidth: 1000, imageHeight: 1500, focalX: 50, focalY: 25 },
    left: 50,
    top: 12.5,
  },
  {
    // dw = 390, dh = 585; oy = 122 - 146.25 = -24.25; top = 24.25 / 341
    name: 'vector A: frame 390x244, image 1200x1800, focal (50, 25)',
    input: { frameWidth: 390, frameHeight: 244, imageWidth: 1200, imageHeight: 1800, focalX: 50, focalY: 25 },
    left: 50,
    top: (24.25 / 341) * 100,
  },
  {
    // s = 380/1350, dw = 675.6, dh = 380; ox = 195 - 202.67 = -7.67; left = 7.67 / 285.6
    name: 'vector B: frame 390x380, image 2400x1350, focal (30, 50)',
    input: { frameWidth: 390, frameHeight: 380, imageWidth: 2400, imageHeight: 1350, focalX: 30, focalY: 50 },
    left: ((380 / 1350) * 2400 * 0.3 - 195) / ((380 / 1350) * 2400 - 390) * 100,
    top: 50,
  },
  {
    // dw = 900, dh = 506.25; desired oy = 190 - 455.6 < -126.25 -> clamped to bottom
    name: 'vector C: frame 900x380, image 2400x1350, focal (50, 90) clamps to the bottom',
    input: { frameWidth: 900, frameHeight: 380, imageWidth: 2400, imageHeight: 1350, focalX: 50, focalY: 90 },
    left: 50,
    top: 100,
  },
];

describe('focalCoverPosition', () => {
  it.each(cases)('$name', ({ input, left, top }) => {
    const result = focalCoverPosition(input);
    expect(pct(result.left)).toBeCloseTo(left, 2);
    expect(pct(result.top)).toBeCloseTo(top, 2);
    expect(result.left.endsWith('%')).toBe(true);
    expect(result.top.endsWith('%')).toBe(true);
  });

  it('should match the documented rounded values for the shared vectors', () => {
    const a = focalCoverPosition({ frameWidth: 390, frameHeight: 244, imageWidth: 1200, imageHeight: 1800, focalX: 50, focalY: 25 });
    const b = focalCoverPosition({ frameWidth: 390, frameHeight: 380, imageWidth: 2400, imageHeight: 1350, focalX: 30, focalY: 50 });
    const c = focalCoverPosition({ frameWidth: 900, frameHeight: 380, imageWidth: 2400, imageHeight: 1350, focalX: 50, focalY: 90 });
    expect([pct(a.left), pct(a.top)].map((n) => n.toFixed(2))).toEqual(['50.00', '7.11']);
    expect([pct(b.left), pct(b.top)].map((n) => n.toFixed(2))).toEqual(['2.68', '50.00']);
    expect([pct(c.left), pct(c.top)].map((n) => n.toFixed(2))).toEqual(['50.00', '100.00']);
  });

  it.each([
    ['zero frame width', { frameWidth: 0, frameHeight: 200, imageWidth: 100, imageHeight: 100 }],
    ['zero image height', { frameWidth: 200, frameHeight: 200, imageWidth: 100, imageHeight: 0 }],
    ['NaN frame height', { frameWidth: 200, frameHeight: NaN, imageWidth: 100, imageHeight: 100 }],
    ['negative image width', { frameWidth: 200, frameHeight: 200, imageWidth: -5, imageHeight: 100 }],
  ])('should fall back to 50%%/50%% when given %s', (_n, sizes) => {
    expect(focalCoverPosition({ ...sizes, focalX: 10, focalY: 90 })).toEqual({ left: '50%', top: '50%' });
  });

  it('should clamp out-of-range focal values', () => {
    const r = focalCoverPosition({ frameWidth: 400, frameHeight: 200, imageWidth: 1000, imageHeight: 2000, focalX: 50, focalY: 250 });
    expect(r.top).toBe('100%');
  });
});

/**
 * Shared cases: padmakara-api/tests/services/focal-cover.test.ts carries the same table and checks
 * the admin preview against it, so the previews and the app cannot drift apart.
 */
const ZOOM_CASES: Array<{
  name: string;
  input: [number, number, number, number, number, number, number];
  expected: { w: number; h: number; ox: number; oy: number };
}> = [
  {
    name: 'zoom 1 keeps the plain cover fit',
    input: [390, 260, 1200, 1800, 50, 25, 1],
    expected: { w: 390, h: 585, ox: 0, oy: -16.25 },
  },
  {
    name: 'zoom 2 doubles the cover size and centres on the focal point',
    input: [390, 260, 1200, 1800, 50, 25, 2],
    expected: { w: 780, h: 1170, ox: -195, oy: -162.5 },
  },
  {
    name: 'zoom 1.5 on a landscape image centres on an off-centre focal point',
    input: [390, 380, 2400, 1350, 30, 50, 1.5],
    expected: { w: 1013.33, h: 570, ox: -109, oy: -95 },
  },
  {
    name: 'zoom 3 at the bottom-right corner is clamped so the frame stays covered',
    input: [400, 280, 1000, 1000, 100, 100, 3],
    expected: { w: 1200, h: 1200, ox: -800, oy: -920 },
  },
  {
    name: 'zoom above 3 is treated as 3',
    input: [400, 280, 1000, 1000, 100, 100, 5],
    expected: { w: 1200, h: 1200, ox: -800, oy: -920 },
  },
];

const r2 = (n: number) => Math.round(n * 100) / 100 + 0;
const toInput = ([frameWidth, frameHeight, imageWidth, imageHeight, focalX, focalY, zoom]: number[]) => ({
  frameWidth,
  frameHeight,
  imageWidth,
  imageHeight,
  focalX,
  focalY,
  zoom,
});

describe('focalCoverPlacement (shared with the admin previews)', () => {
  it.each(ZOOM_CASES)('should match the shared table when $name', ({ input, expected }) => {
    const p = focalCoverPlacement(toInput(input));
    expect({ w: r2(p.width), h: r2(p.height), ox: r2(p.offsetX), oy: r2(p.offsetY) }).toEqual(expected);
  });

  it('should return a zero offset when sizes are invalid', () => {
    expect(focalCoverPlacement({ frameWidth: 100, frameHeight: 100, imageWidth: 0, imageHeight: 200, focalX: 30, focalY: 30 })).toEqual({
      width: 100,
      height: 100,
      offsetX: 0,
      offsetY: 0,
    });
  });
});

describe('focalCoverTransform', () => {
  it.each(ZOOM_CASES)('should land the image where the placement says when $name', ({ input }) => {
    // A frame-sized view with a centred cover image, scaled around the frame centre then translated.
    const i = toInput(input);
    const p = focalCoverPlacement(i);
    const t = focalCoverTransform(i);
    const s = Math.max(i.frameWidth / i.imageWidth, i.frameHeight / i.imageHeight);
    const coverW = i.imageWidth * s;
    const coverH = i.imageHeight * s;
    const leftBefore = (i.frameWidth - coverW) / 2;
    const topBefore = (i.frameHeight - coverH) / 2;
    const left = i.frameWidth / 2 + t.scale * (leftBefore - i.frameWidth / 2) + t.translateX;
    const top = i.frameHeight / 2 + t.scale * (topBefore - i.frameHeight / 2) + t.translateY;
    expect(r2(left)).toBe(r2(p.offsetX));
    expect(r2(top)).toBe(r2(p.offsetY));
    expect(r2(coverW * t.scale)).toBe(r2(p.width));
  });
});
