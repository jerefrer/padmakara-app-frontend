import { focalCoverPosition } from '../../utils/focalCover';

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
