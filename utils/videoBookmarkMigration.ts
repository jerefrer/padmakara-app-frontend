/**
 * One-time upload of the video bookmarks that older app versions kept only
 * in AsyncStorage (`bookmarks_video-{id}`). Pure and storage-agnostic so it
 * can be tested without React Native.
 */

export interface VideoBookmarkPayload {
  videoId: number;
  positionSeconds: number;
  note?: string;
  createdAt?: string;
}

interface LocalVideoBookmark {
  position?: unknown;
  note?: unknown;
  createdAt?: unknown;
}

export interface MigrationStorage {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
}

/** Turn the stored JSON into API payloads, skipping unusable entries. */
export function parseLocalVideoBookmarks(
  raw: string | null,
  videoId: number,
): VideoBookmarkPayload[] {
  if (!raw) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];

  const payloads: VideoBookmarkPayload[] = [];
  for (const item of list as LocalVideoBookmark[]) {
    if (typeof item?.position !== 'number' || !Number.isFinite(item.position) || item.position < 0) {
      continue;
    }
    const note = typeof item.note === 'string' ? item.note.trim() : '';
    const createdAt =
      typeof item.createdAt === 'string' && !Number.isNaN(Date.parse(item.createdAt))
        ? new Date(item.createdAt).toISOString()
        : undefined;
    payloads.push({
      videoId,
      positionSeconds: Math.floor(item.position),
      note: note || undefined,
      createdAt,
    });
  }
  return payloads;
}

// Keys being migrated right now, so a re-render cannot upload the same list twice.
const inFlight = new Set<string>();

/**
 * Upload the local bookmarks of one video, then drop the local key — only
 * when every upload succeeded. A failure leaves the local list intact, so
 * the next load retries (a retry can duplicate the ones that did succeed).
 */
export async function migrateLocalVideoBookmarks(args: {
  videoId: number;
  storageKey: string;
  storage: MigrationStorage;
  upload: (payload: VideoBookmarkPayload) => Promise<boolean>;
}): Promise<{ uploaded: number; cleared: boolean }> {
  const { videoId, storageKey, storage, upload } = args;
  if (inFlight.has(storageKey)) return { uploaded: 0, cleared: false };
  inFlight.add(storageKey);
  try {
    const payloads = parseLocalVideoBookmarks(await storage.getItem(storageKey), videoId);
    if (payloads.length === 0) return { uploaded: 0, cleared: false };

    let uploaded = 0;
    for (const payload of payloads) {
      let ok = false;
      try {
        ok = await upload(payload);
      } catch {
        ok = false;
      }
      if (!ok) return { uploaded, cleared: false };
      uploaded += 1;
    }
    await storage.removeItem(storageKey);
    return { uploaded, cleared: true };
  } catch {
    return { uploaded: 0, cleared: false };
  } finally {
    inFlight.delete(storageKey);
  }
}
