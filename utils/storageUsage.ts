/**
 * On-disk size helpers for the Offline & storage screen.
 *
 * The services keep their own metadata (AsyncStorage) about what they have
 * written, but metadata drifts from reality: interrupted downloads, lost
 * metadata and partial files all leave bytes on disk that no service knows
 * about. These helpers measure the directories themselves.
 */

import * as FileSystem from 'expo-file-system/legacy';

/** Guard against pathological nesting (symlink loops, runaway trees). */
const MAX_DEPTH = 8;

export interface DirEntry {
  name: string;
  uri: string;
  size: number;
  isDirectory: boolean;
  /** Last modification, in seconds since the epoch (0 when unknown). */
  modifiedAt: number;
}

/** Make sure a directory uri ends with exactly one slash. */
export function withTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`;
}

interface PathStats {
  size: number;
  /** Most recent modification below (or of) the path, seconds since the epoch. */
  modifiedAt: number;
}

const EMPTY_STATS: PathStats = { size: 0, modifiedAt: 0 };

/**
 * Size and latest modification of a file, or of everything below a
 * directory. Missing paths and unreadable entries count as empty. The
 * deepest modification time matters: a folder's own timestamp does not move
 * while a file inside it is still being written.
 */
export async function getPathStats(uri: string, depth = 0): Promise<PathStats> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return EMPTY_STATS;
    if (!info.isDirectory) {
      return { size: 'size' in info ? info.size || 0 : 0, modifiedAt: info.modificationTime || 0 };
    }
    if (depth >= MAX_DEPTH) return EMPTY_STATS;
    const names = await FileSystem.readDirectoryAsync(uri);
    const base = withTrailingSlash(uri);
    const children = await Promise.all(names.map((name) => getPathStats(`${base}${name}`, depth + 1)));
    return children.reduce(
      (acc, c) => ({ size: acc.size + c.size, modifiedAt: Math.max(acc.modifiedAt, c.modifiedAt) }),
      { size: 0, modifiedAt: info.modificationTime || 0 },
    );
  } catch {
    return EMPTY_STATS;
  }
}

/** Size in bytes of a file, or of everything below a directory. */
export async function getPathSize(uri: string): Promise<number> {
  return (await getPathStats(uri)).size;
}

/** Direct children of a directory with their recursive sizes. */
export async function listDirectory(uri: string): Promise<DirEntry[]> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || !info.isDirectory) return [];
    const base = withTrailingSlash(uri);
    const names = await FileSystem.readDirectoryAsync(uri);
    return await Promise.all(
      names.map(async (name) => {
        const childUri = `${base}${name}`;
        const childInfo = await FileSystem.getInfoAsync(childUri);
        const stats = await getPathStats(childUri, 1);
        return {
          name,
          uri: childUri,
          isDirectory: childInfo.exists && childInfo.isDirectory,
          size: stats.size,
          modifiedAt: stats.modifiedAt,
        };
      }),
    );
  } catch {
    return [];
  }
}

/** Delete every child of a directory but keep the directory itself. */
export async function emptyDirectory(uri: string, keep: (entry: DirEntry) => boolean = () => false): Promise<number> {
  const entries = await listDirectory(uri);
  let freed = 0;
  for (const entry of entries) {
    if (keep(entry)) continue;
    try {
      await FileSystem.deleteAsync(entry.uri, { idempotent: true });
      freed += entry.size;
    } catch {
      // Best-effort: a file that cannot be removed stays counted.
    }
  }
  return freed;
}

export interface StorageBreakdown {
  /** Auto-cached audio (cacheDirectory/audio), everything on disk. */
  cache: number;
  /** Downloaded retreats still known to the download service. */
  downloads: number;
  /** Offline videos. */
  videos: number;
  /** Cached publication PDFs. */
  publications: number;
  /** Event files, transcripts, single-track downloads and orphaned downloads. */
  other: number;
  /** Sum of every bucket above. */
  total: number;
}

interface BreakdownInput {
  cache: number;
  downloads: number;
  videos: number;
  publications: number;
  eventFiles: number;
  transcripts: number;
  tracks: number;
  /** Bytes under downloads/ that no known retreat owns. */
  orphanedDownloads: number;
}

/** Combine measured sizes into the buckets the storage screen shows. */
export function buildStorageBreakdown(input: BreakdownInput): StorageBreakdown {
  const other = input.eventFiles + input.transcripts + input.tracks + input.orphanedDownloads;
  return {
    cache: input.cache,
    downloads: input.downloads,
    videos: input.videos,
    publications: input.publications,
    other,
    total: input.cache + input.downloads + input.videos + input.publications + other,
  };
}

export interface BarSegment {
  key: 'cache' | 'downloads' | 'videos' | 'publications' | 'other';
  /** Width as a percentage of the bar (0-100). */
  percent: number;
}

/** Share of each bucket in the total, as bar widths. Empty buckets are dropped. */
export function getBarSegments(breakdown: StorageBreakdown): BarSegment[] {
  if (breakdown.total <= 0) return [];
  const keys: BarSegment['key'][] = ['cache', 'downloads', 'videos', 'publications', 'other'];
  return keys
    .filter((key) => breakdown[key] > 0)
    .map((key) => ({ key, percent: (breakdown[key] / breakdown.total) * 100 }));
}
