import { Dimensions, Platform } from 'react-native';
import retreatService from './retreatService';
import apiService from './apiService';
import { API_ENDPOINTS } from './apiConfig';
import {
  teacherAvatarCacheKey,
  teacherHeroCacheKey,
  groupAvatarCacheKey,
  groupHeroCacheKey,
} from '@/utils/cacheKeys';
import { selectHero } from '@/utils/heroVariant';

/**
 * Mirrors the breakpoint in `useDesktopLayout` so prefetched bytes match
 * the variant the screen will actually request: native + narrow web ⇒
 * mobile (1200px), wider web ⇒ desktop (2400px). Read once at prefetch
 * time — refetching after a window resize on web would tear the cooldown
 * accounting and is not worth the complexity for a few hidden Image tags.
 */
function isMobileViewport(): boolean {
  if (Platform.OS !== 'web') return true;
  return Dimensions.get('window').width < 768;
}

export interface PrefetchTarget {
  uri: string;
  cacheKey: string;
}

/**
 * Discovers every avatar / hero URL we'll want to display in the app
 * (groups + teachers), tags each with the same `cacheKey` the screens use,
 * and returns the list. The actual image warming is done by the
 * <ImagePrewarmer> component (see contexts/AuthContext) which renders
 * these as 1×1 hidden <Image> instances at the root of the tree — that
 * way they stay in expo-image's memory + disk cache for the whole
 * session and screen renders pick them up instantly instead of going
 * through the grey-placeholder flash.
 *
 * `Image.prefetch` from expo-image 3.x does NOT accept a cacheKey, so
 * URL-based prefetching mismatches the cacheKey-based render lookup —
 * hence the offscreen-render approach.
 */
class ImagePrefetchService {
  private static instance: ImagePrefetchService;
  private lastFetchAt = 0;
  private readonly COOLDOWN_MS = 5 * 60 * 1000; // 5 min

  static getInstance(): ImagePrefetchService {
    if (!ImagePrefetchService.instance) {
      ImagePrefetchService.instance = new ImagePrefetchService();
    }
    return ImagePrefetchService.instance;
  }

  /** Force the next call to refetch — use after sign-in / sign-out. */
  resetCooldown(): void {
    this.lastFetchAt = 0;
  }

  /**
   * Walk the public events + (when authenticated) groups APIs and return
   * the deduped list of (uri, cacheKey) pairs to prewarm. Each cacheKey
   * matches what the corresponding <Image> in screens uses.
   */
  async collectAvatarsAndHeros(opts: { isAuthenticated: boolean }): Promise<PrefetchTarget[]> {
    const now = Date.now();
    if (now - this.lastFetchAt < this.COOLDOWN_MS) {
      // Cooldown active — return empty list, the prewarmer keeps its
      // current Image instances mounted so cache stays hot.
      return [];
    }
    this.lastFetchAt = now;

    const out = new Map<string, PrefetchTarget>(); // dedup by cacheKey

    const push = (uri: string | null | undefined, cacheKey: string) => {
      if (!uri) return;
      if (out.has(cacheKey)) return;
      out.set(cacheKey, { uri, cacheKey });
    };

    const mobile = isMobileViewport();

    // Public events — always available
    try {
      const res = await retreatService.getPublicEvents();
      if (res.success && res.data) {
        for (const ev of res.data as any[]) {
          for (const teacher of ev.teachers || []) {
            push(teacher.avatarUrl, teacherAvatarCacheKey(teacher));
            const hero = selectHero(teacher, mobile);
            push(hero.url, teacherHeroCacheKey(teacher, hero.variant));
          }
        }
      }
    } catch {
      // Ignore — best effort.
    }

    // Authenticated groups — only for signed-in users
    if (opts.isAuthenticated) {
      try {
        const groupsRes = await apiService.get<any[]>(API_ENDPOINTS.GROUPS);
        if (groupsRes.success && groupsRes.data) {
          for (const group of groupsRes.data) {
            push(group.avatarUrl, groupAvatarCacheKey(group));
            const hero = selectHero(group, mobile);
            push(hero.url, groupHeroCacheKey(group, hero.variant));
          }
        }
      } catch {
        // Ignore — best effort.
      }
    }

    return Array.from(out.values());
  }
}

export default ImagePrefetchService.getInstance();
