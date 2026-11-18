/**
 * The "Last opened" order of the Publications screen: the texts a person
 * opened most recently come first, so the ones they use most stay on top;
 * the ones they never opened follow, newest first.
 *
 * Two sources say when a publication was last opened: the server
 * (`lastOpenedAt`, the signed-in person's opens on any device) and this
 * device's own record (kept signed out and offline too). The later one wins.
 */

/** Publication id → when it was last opened on this device (epoch ms). */
export type DeviceOpenTimes = Record<string, number>;

interface OrderablePublication {
  id: string;
  publicationDate: string | null;
  updatedAt: string;
  lastOpenedAt?: string | null;
}

/** When the publication was last opened (epoch ms), or null if never. */
export function lastOpenedTime(publication: OrderablePublication, deviceTimes: DeviceOpenTimes): number | null {
  const server = publication.lastOpenedAt ? Date.parse(publication.lastOpenedAt) : NaN;
  const device = deviceTimes[publication.id];
  const times = [server, device].filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
  return times.length > 0 ? Math.max(...times) : null;
}

/** Newest first, as the former "Latest" tab ordered every publication. */
function newestFirst(a: OrderablePublication, b: OrderablePublication): number {
  const dateA = a.publicationDate || a.updatedAt || '';
  const dateB = b.publicationDate || b.updatedAt || '';
  return dateB.localeCompare(dateA);
}

/** A sorted copy of `publications` in the "Last opened" order. */
export function sortByLastOpened<P extends OrderablePublication>(publications: P[], deviceTimes: DeviceOpenTimes): P[] {
  const opened = new Map(publications.map((p) => [p.id, lastOpenedTime(p, deviceTimes)]));
  return [...publications].sort((a, b) => {
    const timeA = opened.get(a.id) ?? null;
    const timeB = opened.get(b.id) ?? null;
    if (timeA !== null && timeB !== null) return timeB - timeA || newestFirst(a, b);
    if (timeA !== null) return -1;
    if (timeB !== null) return 1;
    return newestFirst(a, b);
  });
}
