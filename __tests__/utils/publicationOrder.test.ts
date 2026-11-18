import { lastOpenedTime, sortByLastOpened } from '@/utils/publicationOrder';

const pub = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  publicationDate: null as string | null,
  updatedAt: '2025-01-01T00:00:00.000Z',
  lastOpenedAt: null as string | null,
  ...extra,
});

describe('lastOpenedTime', () => {
  it('should take the later of the server time and the device time', () => {
    const p = pub('1', { lastOpenedAt: '2026-11-10T00:00:00.000Z' });

    expect(lastOpenedTime(p, { '1': Date.parse('2026-11-12T00:00:00.000Z') })).toBe(
      Date.parse('2026-11-12T00:00:00.000Z'),
    );
    expect(lastOpenedTime(p, { '1': Date.parse('2026-11-01T00:00:00.000Z') })).toBe(
      Date.parse('2026-11-10T00:00:00.000Z'),
    );
  });

  it('should use whichever time exists when only one does', () => {
    expect(lastOpenedTime(pub('1', { lastOpenedAt: '2026-11-10T00:00:00.000Z' }), {})).toBe(
      Date.parse('2026-11-10T00:00:00.000Z'),
    );
    expect(lastOpenedTime(pub('1'), { '1': 5 })).toBe(5);
  });

  it('should return null when the publication was never opened, ignoring unreadable times', () => {
    expect(lastOpenedTime(pub('1'), {})).toBeNull();
    expect(lastOpenedTime(pub('1', { lastOpenedAt: 'not a date' }), {})).toBeNull();
    expect(lastOpenedTime(pub('1', { lastOpenedAt: undefined }), {})).toBeNull();
  });
});

describe('sortByLastOpened', () => {
  it('should put opened publications first, most recently opened on top', () => {
    const list = [
      pub('a'),
      pub('b', { lastOpenedAt: '2026-11-01T00:00:00.000Z' }),
      pub('c'),
      pub('d', { lastOpenedAt: '2026-11-15T00:00:00.000Z' }),
    ];

    const order = sortByLastOpened(list, { c: Date.parse('2026-11-10T00:00:00.000Z') }).map((p) => p.id);

    expect(order.slice(0, 3)).toEqual(['d', 'c', 'b']);
  });

  it('should list never-opened publications after them, newest first', () => {
    const list = [
      pub('old', { publicationDate: '2020-05-01' }),
      pub('opened', { publicationDate: '2019-01-01', lastOpenedAt: '2026-11-01T00:00:00.000Z' }),
      pub('new', { publicationDate: '2025-03-01' }),
      pub('undated', { updatedAt: '2024-01-01T00:00:00.000Z' }),
    ];

    expect(sortByLastOpened(list, {}).map((p) => p.id)).toEqual(['opened', 'new', 'undated', 'old']);
  });

  it('should not change the list it is given', () => {
    const list = [pub('a'), pub('b', { lastOpenedAt: '2026-11-01T00:00:00.000Z' })];

    sortByLastOpened(list, {});

    expect(list.map((p) => p.id)).toEqual(['a', 'b']);
  });
});
