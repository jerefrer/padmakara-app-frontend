import { ReadAlongData } from '@/types';

/**
 * Service for loading and caching Read Along alignment data.
 * Alignment JSON files contain word-level timestamps matched to PDF transcripts.
 */
class ReadAlongService {
  private static instance: ReadAlongService;
  private cache = new Map<string, ReadAlongData>();

  static getInstance(): ReadAlongService {
    if (!ReadAlongService.instance) {
      ReadAlongService.instance = new ReadAlongService();
    }
    return ReadAlongService.instance;
  }

  /**
   * Load alignment data for a track from its readAlongFile URL.
   * Results are cached in memory for the session.
   */
  async loadAlignment(url: string): Promise<ReadAlongData | null> {
    // Check cache
    const cached = this.cache.get(url);
    if (cached) return cached;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[ReadAlong] Failed to fetch alignment: ${response.status}`);
        return null;
      }

      const json = await response.json();

      // Validate minimal structure
      if (!json.clean_segments || !Array.isArray(json.clean_segments)) {
        console.warn('[ReadAlong] Invalid alignment data: missing clean_segments');
        return null;
      }

      const data: ReadAlongData = {
        clean_segments: json.clean_segments,
        stats: json.stats || {
          clean_words: 0,
          words_high: 0,
          words_medium: 0,
          words_low: 0,
          usable_pct: 0,
        },
      };

      this.cache.set(url, data);
      return data;
    } catch (error) {
      console.warn('[ReadAlong] Error loading alignment:', error);
      return null;
    }
  }

  /** Clear the in-memory cache */
  clearCache(): void {
    this.cache.clear();
  }

  /** Remove a specific entry from cache */
  evict(url: string): void {
    this.cache.delete(url);
  }
}

export default ReadAlongService.getInstance();
