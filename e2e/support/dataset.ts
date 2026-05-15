/**
 * Seeded-dataset helper for the Playwright e2e suite.
 *
 * Fetches the resolved DB ids of the deterministic e2e seed dataset from the
 * backend's test-only `GET /api/test/dataset` endpoint, so specs can navigate
 * to exact events / sessions / tracks / transcripts without hard-coding
 * seed-order ids.
 *
 * The dataset is fetched once and memoised — the seed is created once per
 * Playwright run by the infra runner, so it is stable for the whole session.
 */

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3100/api';

/** Resolved ids for one seeded event. */
export interface DatasetEvent {
  eventId: number;
  titleEn: string | null;
  sessionIds: number[];
  trackIds: number[];
  transcriptIds: number[];
}

/** Resolved ids for one seeded retreat group. */
export interface DatasetGroup {
  id: number;
  slug: string;
  abbreviation: string | null;
  nameEn: string;
}

/** The full seeded dataset, keyed by event code. */
export interface Dataset {
  groups: DatasetGroup[];
  events: Record<string, DatasetEvent>;
}

let cached: Dataset | null = null;

/** Fetch (and memoise) the seeded dataset id map from the backend. */
export async function getDataset(): Promise<Dataset> {
  if (cached) return cached;
  const res = await fetch(`${API_BASE}/test/dataset`);
  if (!res.ok) {
    throw new Error(
      `[e2e dataset] GET /api/test/dataset failed: ${res.status} ${await res.text()}`,
    );
  }
  cached = (await res.json()) as Dataset;
  return cached;
}

/** Convenience: resolve one event by its E2E-* code. Throws if not seeded. */
export async function getEvent(eventCode: string): Promise<DatasetEvent> {
  const ds = await getDataset();
  const ev = ds.events[eventCode];
  if (!ev) {
    throw new Error(
      `[e2e dataset] No seeded event with code "${eventCode}". ` +
        `Available: ${Object.keys(ds.events).join(', ')}`,
    );
  }
  return ev;
}

/** Convenience: resolve the single seeded retreat group. */
export async function getGroup(): Promise<DatasetGroup> {
  const ds = await getDataset();
  const group = ds.groups[0];
  if (!group) {
    throw new Error('[e2e dataset] No seeded retreat group found.');
  }
  return group;
}

/** Event codes present in the seed dataset. */
export const EVENT_CODES = {
  anyone: 'E2E-ANYONE',
  subscribers: 'E2E-SUBS',
  groupMembers: 'E2E-GROUP',
  participants: 'E2E-PART',
  onRequest: 'E2E-REQ',
  initiation: 'E2E-INIT',
} as const;
