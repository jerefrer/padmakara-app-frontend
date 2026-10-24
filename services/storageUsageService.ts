/**
 * Storage usage — what the app really has on disk.
 *
 * Every figure comes from walking the directories, not from service
 * metadata, so orphaned and partial files are counted. Cache-only
 * directories can be emptied freely; directories holding user-chosen
 * content (downloads, videos, publications) are only ever touched for
 * files no service knows about.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
  buildStorageBreakdown,
  emptyDirectory,
  getPathSize,
  listDirectory,
  type DirEntry,
  type StorageBreakdown,
} from '@/utils/storageUsage';

/** A file touched this recently may belong to a download still in flight. */
const RECENT_FILE_SECONDS = 10 * 60;

const TRACK_DOWNLOAD_PREFIX = '@download:';

/** True when a file or folder changed recently enough to still be downloading. */
const isRecent = (entry: DirEntry) => entry.modifiedAt > Date.now() / 1000 - RECENT_FILE_SECONDS;

const documentDir = () => FileSystem.documentDirectory ?? '';
const cacheDir = () => FileSystem.cacheDirectory ?? '';

/** Every directory the app writes to, relative to document/cache storage. */
export const storageDirs = {
  audioCache: () => `${cacheDir()}audio/`,
  eventFiles: () => `${cacheDir()}event-files/`,
  transcripts: () => `${cacheDir()}transcripts/`,
  downloads: () => `${documentDir()}downloads/`,
  tracks: () => `${documentDir()}tracks/`,
  publications: () => `${documentDir()}publications/`,
  videos: () => `${documentDir()}videos/`,
};

export interface StorageUsage extends StorageBreakdown {
  /** Part of `other` that "Free up other space" can remove. */
  orphanBytes: number;
  /** Bytes "Clear cache" can remove: audio cache, event files and transcripts. */
  clearableBytes: number;
}

/** Local paths of single-track downloads that still have metadata. */
async function getKnownTrackPaths(): Promise<Set<string>> {
  const paths = new Set<string>();
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(TRACK_DOWNLOAD_PREFIX));
    const entries = await AsyncStorage.multiGet(keys);
    for (const [, raw] of entries) {
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { localPath?: string };
      if (parsed.localPath) paths.add(parsed.localPath);
    }
  } catch {
    // With unreadable metadata every file would look orphaned, so callers
    // must skip the directory instead of guessing.
    throw new Error('Could not read track download metadata');
  }
  return paths;
}

async function findOrphans(knownRetreatIds: string[]): Promise<DirEntry[]> {
  const known = new Set(knownRetreatIds);
  const orphans: DirEntry[] = [];

  const downloads = await listDirectory(storageDirs.downloads());
  for (const entry of downloads) {
    if (!known.has(entry.name) && !isRecent(entry)) orphans.push(entry);
  }

  try {
    const knownTracks = await getKnownTrackPaths();
    const tracks = await listDirectory(storageDirs.tracks());
    for (const entry of tracks) {
      if (!knownTracks.has(entry.uri) && !isRecent(entry)) orphans.push(entry);
    }
  } catch {
    // Track metadata unreadable — leave the tracks directory alone.
  }
  return orphans;
}

/**
 * Measure everything. `knownRetreatIds` are the folder names (retreat ids)
 * under downloads/ that the download service owns.
 */
export async function getStorageUsage(knownRetreatIds: string[]): Promise<StorageUsage> {
  if (Platform.OS === 'web') {
    return { ...buildStorageBreakdown({ cache: 0, downloads: 0, videos: 0, publications: 0, eventFiles: 0, transcripts: 0, tracks: 0, orphanedDownloads: 0 }), orphanBytes: 0, clearableBytes: 0 };
  }

  const downloadsDir = storageDirs.downloads();
  const [cache, videos, publications, eventFiles, transcripts, tracks, downloadsTotal, ...known] = await Promise.all([
    getPathSize(storageDirs.audioCache()),
    getPathSize(storageDirs.videos()),
    getPathSize(storageDirs.publications()),
    getPathSize(storageDirs.eventFiles()),
    getPathSize(storageDirs.transcripts()),
    getPathSize(storageDirs.tracks()),
    getPathSize(downloadsDir),
    ...knownRetreatIds.map((id) => getPathSize(`${downloadsDir}${id}`)),
  ]);
  const downloads = known.reduce((sum, s) => sum + s, 0);
  const orphans = await findOrphans(knownRetreatIds);
  const orphanBytes = orphans.reduce((sum, o) => sum + o.size, 0);

  return {
    ...buildStorageBreakdown({
      cache,
      downloads,
      videos,
      publications,
      eventFiles,
      transcripts,
      // Orphaned retreat folders are the part of downloads/ no known retreat owns.
      tracks,
      orphanedDownloads: Math.max(0, downloadsTotal - downloads),
    }),
    orphanBytes,
    clearableBytes: cache + eventFiles + transcripts,
  };
}

/**
 * Remove leftovers from the cache-only directories: audio files the cache
 * metadata no longer tracks, plus all event files and transcripts. Call it
 * after the cache service has cleared the files it knows about. Returns the
 * bytes freed.
 */
export async function clearCacheOnlyFiles(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  let freed = await emptyDirectory(storageDirs.audioCache(), isRecent);
  freed += await emptyDirectory(storageDirs.eventFiles());
  freed += await emptyDirectory(storageDirs.transcripts());
  return freed;
}

/**
 * Remove files in document storage that no download record owns: retreat
 * folders left by interrupted downloads and single-track files without
 * metadata. Never touches videos, publications or known downloads.
 */
export async function removeOrphanedDocuments(knownRetreatIds: string[]): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const orphans = await findOrphans(knownRetreatIds);
  let freed = 0;
  for (const orphan of orphans) {
    try {
      await FileSystem.deleteAsync(orphan.uri, { idempotent: true });
      freed += orphan.size;
    } catch {
      // Leave it; it stays counted.
    }
  }
  return freed;
}
