import { ReadAlongData } from '@/types';

interface CacheEntry {
  data: ReadAlongData;
  /** JSON string for fast equality check on revalidation */
  raw: string;
}

/**
 * Service for loading and caching Read Along alignment data.
 *
 * Uses a stale-while-revalidate strategy:
 * - If cached data exists, return it immediately for instant display
 * - Always re-fetch from S3 in the background (bypassing browser cache)
 * - If the new data differs, call the onUpdate callback so the UI refreshes
 */
class ReadAlongService {
  private static instance: ReadAlongService;
  /** Cache keyed by S3 path (URL without query/signature params) */
  private cache = new Map<string, CacheEntry>();

  static getInstance(): ReadAlongService {
    if (!ReadAlongService.instance) {
      ReadAlongService.instance = new ReadAlongService();
    }
    return ReadAlongService.instance;
  }

  /** Extract stable S3 path from a presigned URL (strip query params) */
  private cacheKey(url: string): string {
    try {
      const u = new URL(url);
      return u.origin + u.pathname;
    } catch {
      return url;
    }
  }

  private parseResponse(json: unknown): ReadAlongData | null {
    const obj = json as Record<string, unknown>;
    if (!obj?.clean_segments || !Array.isArray(obj.clean_segments)) {
      return null;
    }
    return {
      clean_segments: obj.clean_segments,
      stats: (obj.stats as ReadAlongData['stats']) || {
        clean_words: 0,
        words_high: 0,
        words_medium: 0,
        words_low: 0,
        usable_pct: 0,
      },
    };
  }

  /**
   * Load alignment data with stale-while-revalidate.
   *
   * Returns cached data immediately if available. Always re-fetches in the
   * background; if the data changed, calls `onUpdate` with the new data.
   */
  async loadAlignment(
    url: string,
    onUpdate?: (data: ReadAlongData) => void,
  ): Promise<ReadAlongData | null> {
    const key = this.cacheKey(url);
    const cached = this.cache.get(key);

    const doFetch = async (): Promise<ReadAlongData | null> => {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          console.warn(`[ReadAlong] Failed to fetch alignment: ${response.status}`);
          return null;
        }

        const raw = await response.text();
        const json = JSON.parse(raw);
        const data = this.parseResponse(json);
        if (!data) {
          console.warn('[ReadAlong] Invalid alignment data: missing clean_segments');
          return null;
        }

        // Update cache; notify if data changed
        const prev = this.cache.get(key);
        this.cache.set(key, { data, raw });
        if (prev && prev.raw !== raw && onUpdate) {
          onUpdate(data);
        }

        return data;
      } catch (error) {
        console.warn('[ReadAlong] Error loading alignment:', error);
        return null;
      }
    };

    if (cached) {
      // Return stale data now, revalidate in background
      doFetch();
      return cached.data;
    }

    // No cache — must wait for the fetch
    return doFetch();
  }

  /** Clear the in-memory cache */
  clearCache(): void {
    this.cache.clear();
  }

  /** Remove a specific entry from cache */
  evict(url: string): void {
    this.cache.delete(this.cacheKey(url));
  }
}

export default ReadAlongService.getInstance();
