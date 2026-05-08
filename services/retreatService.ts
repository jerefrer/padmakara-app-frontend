import { Platform } from 'react-native';
import { Gathering, RetreatGroup, Session, Track, SearchResponse } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { API_CONFIG, API_ENDPOINTS, PaginatedResponse } from './apiConfig';
import apiService from './apiService';
import entityCacheService from './entityCacheService';

interface UserRetreatData {
  retreat_groups: RetreatGroup[];
  recent_gatherings: Gathering[];
  total_stats: {
    total_groups: number;
    total_gatherings: number;
    total_tracks: number;
    completed_tracks: number;
  };
}

interface RetreatGroupDetails extends RetreatGroup {
  gatherings: Gathering[];
  is_member: boolean;
}

interface GatheringDetails extends Gathering {
  sessions: Session[];
  retreat_group: {
    id: string;
    name: string;
  };
}

interface SessionDetails extends Session {
  tracks: Track[];
  gathering: {
    id: string;
    name: string;
  };
}

// ─── Backend → Frontend Type Mappers ────────────────────────────────

/** Map backend retreatGroup → frontend RetreatGroup */
function mapGroup(backend: any, gatherings?: Gathering[]): RetreatGroup {
  return {
    id: String(backend.id),
    name: backend.nameEn || backend.name_en || '',
    name_translations: {
      en: backend.nameEn || backend.name_en || '',
      ...(backend.namePt || backend.name_pt
        ? { pt: backend.namePt || backend.name_pt }
        : {}),
    },
    abbreviation: backend.abbreviation || '',
    gatherings: gatherings || [],
    avatarUrl: backend.avatarUrl ?? null,
    heroUrl: backend.heroUrl ?? null,
    heroMobileUrl: backend.heroMobileUrl ?? null,
    heroFocalX: backend.heroFocalX ?? 50,
    heroFocalY: backend.heroFocalY ?? 50,
    heroScale: backend.heroScale ?? 100,
    avatarUpdatedAt: backend.avatarUpdatedAt ?? null,
    heroUpdatedAt: backend.heroUpdatedAt ?? null,
    created_at: backend.createdAt || backend.created_at || '',
    updated_at: backend.updatedAt || backend.updated_at || '',
  };
}

/** Derive season from a date string */
function deriveSeason(dateStr: string): 'spring' | 'fall' {
  if (!dateStr) return 'spring';
  const month = new Date(dateStr).getMonth() + 1;
  return month >= 3 && month <= 8 ? 'spring' : 'fall';
}

/** Map backend event status to frontend Gathering status */
function mapEventStatus(
  status: string,
  startDate: string,
  endDate: string,
): 'draft' | 'upcoming' | 'ongoing' | 'completed' {
  if (status === 'draft') return 'draft';
  if (status === 'archived') return 'completed';

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'ongoing';
  return 'completed';
}

/** Map backend event → frontend Gathering */
export function mapEvent(backend: any): Gathering {
  const startDate = backend.startDate || backend.start_date || '';
  const endDate = backend.endDate || backend.end_date || '';

  return {
    id: String(backend.id),
    name: backend.titleEn || backend.title_en || '',
    name_translations: {
      en: backend.titleEn || backend.title_en || '',
      ...(backend.titlePt || backend.title_pt
        ? { pt: backend.titlePt || backend.title_pt }
        : {}),
    },
    main_topics_translations: {
      ...(backend.mainThemesEn ? { en: backend.mainThemesEn } : {}),
      ...(backend.mainThemesPt ? { pt: backend.mainThemesPt } : {}),
    },
    season: deriveSeason(startDate),
    year: startDate ? new Date(startDate).getFullYear() : 0,
    startDate,
    endDate,
    sessions: backend.sessions?.map(mapSession) || undefined,
    teachers: backend.eventTeachers?.map((et: any) => ({
      id: et.teacher?.id,
      name: et.teacher?.name || '',
      abbreviation: et.teacher?.abbreviation || '',
      photoUrl: et.teacher?.photoUrl || null,
      avatarUrl: et.teacher?.avatarUrl || null,
      heroUrl: et.teacher?.heroUrl || null,
      heroMobileUrl: et.teacher?.heroMobileUrl || null,
      heroFocalX: et.teacher?.heroFocalX ?? 50,
      heroFocalY: et.teacher?.heroFocalY ?? 50,
      heroScale: et.teacher?.heroScale ?? 100,
      avatarUpdatedAt: et.teacher?.avatarUpdatedAt || null,
      heroUpdatedAt: et.teacher?.heroUpdatedAt || null,
    })).filter((t: any) => t.name) || undefined,
    places: backend.eventPlaces?.map((ep: any) => ({
      id: ep.place?.id,
      name: ep.place?.name || '',
      abbreviation: ep.place?.abbreviation ?? null,
      location: ep.place?.location ?? null,
    })).filter((p: any) => p.name) || undefined,
    retreatGroups: backend.eventRetreatGroups?.map((erg: any) => ({
      id: erg.retreatGroup?.id,
      name: erg.retreatGroup?.nameEn || erg.retreatGroup?.name_en || '',
      abbreviation: erg.retreatGroup?.abbreviation ?? null,
    })).filter((g: any) => g.id) || undefined,
    transcripts: backend.transcripts?.map((tr: any) => ({ id: tr.id })) || undefined,
    status: mapEventStatus(backend.status || 'published', startDate, endDate),
    created_at: backend.createdAt || '',
    updated_at: backend.updatedAt || '',
  };
}

/** Map backend session → frontend Session */
function mapSession(backend: any): Session {
  return {
    id: String(backend.id),
    name: backend.titleEn || backend.title_en || `Session ${backend.sessionNumber || backend.session_number || ''}`,
    name_translations: {
      en: backend.titleEn || backend.title_en || `Session ${backend.sessionNumber || ''}`,
      ...(backend.titlePt || backend.title_pt
        ? { pt: backend.titlePt || backend.title_pt }
        : {}),
    },
    type: (backend.timePeriod || backend.time_period || 'other') as Session['type'],
    partNumber: backend.partNumber ?? backend.part_number ?? null,
    date: backend.sessionDate || backend.session_date || '',
    tracks: backend.tracks?.map(mapTrack) || undefined,
    gathering_id: String(backend.eventId || backend.event_id || backend.retreat_id || ''),
    bunnyVideoId: backend.bunnyVideoId ?? backend.bunny_video_id ?? null,
    videoDurationSeconds: backend.videoDurationSeconds ?? backend.video_duration_seconds ?? null,
    videoPosterUrl: backend.videoPosterUrl ?? backend.video_poster_url ?? null,
    created_at: backend.createdAt || '',
    updated_at: backend.updatedAt || '',
  };
}

/** Map backend track → frontend Track */
function mapTrack(backend: any): Track {
  return {
    id: String(backend.id),
    title: backend.title || '',
    duration: backend.durationSeconds || backend.duration_seconds || 0,
    file_size: backend.fileSizeBytes || backend.file_size_bytes || undefined,
    order: backend.trackNumber || backend.track_number || 0,
    session_id: String(backend.sessionId || backend.session_id || ''),
    language: backend.originalLanguage || backend.original_language || backend.language || undefined,
    languages: backend.languages || (backend.originalLanguage ? [backend.originalLanguage] : undefined),
    originalLanguage: backend.originalLanguage || backend.original_language || backend.language || undefined,
    speaker: backend.speaker || undefined,
    speakerName: backend.speakerName || backend.speaker_name || undefined,
    isOriginal: backend.isTranslation != null ? !backend.isTranslation :
                backend.is_translation != null ? !backend.is_translation : undefined,
    isPractice: backend.isPractice ?? backend.is_practice ?? undefined,
    hasReadAlong: backend.hasReadAlong ?? backend.has_read_along ?? false,
    created_at: backend.createdAt || '',
    updated_at: backend.updatedAt || '',
  };
}

// ─── Service ────────────────────────────────────────────────────────

class RetreatService {
  private static instance: RetreatService;
  private activeDownloads = new Map<string, FileSystem.DownloadResumable>();
  private cancelledDownloads = new Set<string>();

  static getInstance(): RetreatService {
    if (!RetreatService.instance) {
      RetreatService.instance = new RetreatService();
    }
    return RetreatService.instance;
  }

  // Legacy download cache helpers (for download tracking only — NOT retreat metadata)
  private async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      // Support both plain objects (downloads) and legacy timestamped wrappers
      if (parsed && typeof parsed === 'object' && 'data' in parsed && 'timestamp' in parsed) {
        return parsed.data as T;
      }
      return parsed as T;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  private async setCachedData<T>(key: string, data: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  // ─── Assembly helpers ──────────────────────────────────────────────

  /** Build UserRetreatData from raw backend arrays (no network calls). */
  private assembleUserRetreats(backendGroups: any[], backendEvents: any[]): UserRetreatData {
    const mappedEvents = backendEvents.map(mapEvent);

    const mappedGroups: RetreatGroup[] = backendGroups.map((bg: any) => {
      const groupEvents = backendEvents
        .filter((ev: any) =>
          ev.eventRetreatGroups?.some(
            (erg: any) => erg.retreatGroupId === bg.id || erg.retreatGroup?.id === bg.id
          )
        )
        .map(mapEvent);
      return mapGroup(bg, groupEvents);
    });

    const recentGatherings = [...mappedEvents]
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 5);

    const totalTracks = mappedEvents.reduce((sum, ev) =>
      sum + (ev.sessions?.reduce((s, sess) => s + (sess.tracks?.length || 0), 0) || 0), 0);

    return {
      retreat_groups: mappedGroups,
      recent_gatherings: recentGatherings,
      total_stats: {
        total_groups: mappedGroups.length,
        total_gatherings: mappedEvents.length,
        total_tracks: totalTracks,
        completed_tracks: 0,
      },
    };
  }

  /** Build RetreatGroupDetails from a backend group object and its mapped events. */
  private assembleGroupDetails(backendGroup: any | undefined, gatherings: Gathering[], groupKey: string): RetreatGroupDetails {
    return {
      ...(backendGroup ? mapGroup(backendGroup, gatherings) : {
        id: groupKey,
        name: '',
        gatherings,
        created_at: '',
        updated_at: '',
      }),
      gatherings,
      is_member: true,
    } as RetreatGroupDetails;
  }

  /** Returns true when the given group row matches the provided key (id / abbreviation / slug). */
  private groupMatchesKey(g: any, groupKey: string): boolean {
    const keyLower = groupKey.toLowerCase();
    return (
      String(g.id) === groupKey
      || (g.abbreviation && String(g.abbreviation).toLowerCase() === keyLower)
      || (g.slug && String(g.slug) === groupKey)
    );
  }

  // ─── Synchronous cache companions ─────────────────────────────────────
  //
  // These methods ONLY consult the in-memory mirror. They return null when
  // the mirror is cold (undefined = not yet read this session) or empty
  // (null = known cache miss). They never hit the network.

  getUserRetreatsSync(): UserRetreatData | null {
    const groups = entityCacheService.getListSync<any>('groups');
    const events = entityCacheService.getListSync<any>('events');
    if (groups === undefined || events === undefined || groups === null || events === null) {
      return null;
    }
    return this.assembleUserRetreats(groups, events);
  }

  getRetreatGroupDetailsSync(groupKey: string): RetreatGroupDetails | null {
    const groups = entityCacheService.getListSync<any>('groups');
    const events = entityCacheService.getListSync<any>('events');
    if (groups === undefined || events === undefined || groups === null || events === null) {
      return null;
    }
    const backendGroup = groups.find((g: any) => this.groupMatchesKey(g, groupKey));
    const groupId = backendGroup?.id;
    const groupEvents = events.filter((ev: any) =>
      ev.eventRetreatGroups?.some(
        (erg: any) => erg.retreatGroupId === groupId || erg.retreatGroup?.id === groupId
      )
    );
    const gatherings = groupEvents.map(mapEvent);
    return this.assembleGroupDetails(backendGroup, gatherings, groupKey);
  }

  getRetreatDetailsSync(retreatId: string): any | null {
    const numericId = Number(retreatId);
    const cached = entityCacheService.getDetailSync<any>('events', numericId);
    if (cached === undefined || cached === null) return null;
    return this.assembleEventDetail(cached);
  }

  getPublicEventsSync(): any[] | null {
    const events = entityCacheService.getListSync<any>('events');
    if (events === undefined || events === null) return null;
    return events.filter((ev: any) => ev.audience?.slug === 'free-anyone').map(mapEvent);
  }

  getFeaturedEventSync(): any | null {
    const events = entityCacheService.getListSync<any>('events');
    if (events === undefined || events === null) return null;
    let featured: any | null = null;
    for (const ev of events) {
      if (!ev.featuredAt) continue;
      if (!featured || ev.featuredAt > featured.featuredAt) {
        featured = ev;
      }
    }
    return featured ? mapEvent(featured) : null;
  }

  getEventsByTeacherSync(abbreviation: string): { teacher: any | null; events: any[] } | null {
    const events = entityCacheService.getListSync<any>('events');
    if (events === undefined || events === null) return null;
    const teacherEvents = events.filter((ev: any) =>
      ev.eventTeachers?.some((et: any) => et.teacher?.abbreviation === abbreviation)
    );
    const mappedEvents = teacherEvents.map(mapEvent);
    let teacher: any | null = null;
    if (teacherEvents.length > 0) {
      const et = teacherEvents[0].eventTeachers?.find(
        (e: any) => e.teacher?.abbreviation === abbreviation
      );
      teacher = et?.teacher ?? null;
    }
    return { teacher, events: mappedEvents };
  }

  // Get all events by teacher abbreviation — cache-first (SWR pattern).
  // Derives teacher detail and their events from the events cache without a
  // network round-trip. Falls back to getPublicEvents on cache miss.
  async getEventsByTeacher(abbreviation: string, opts: { force?: boolean } = {}): Promise<{
    success: boolean;
    teacher: any | null;
    events: any[];
    error?: string;
  }> {
    // 1. Try cache first (skipped when force=true).
    const cachedEvents = opts.force ? null : await entityCacheService.getList<any>('events');
    if (cachedEvents !== null) {
      const teacherEvents = cachedEvents.filter((ev: any) =>
        ev.eventTeachers?.some((et: any) => et.teacher?.abbreviation === abbreviation),
      );
      const mappedEvents = teacherEvents.map(mapEvent);
      // Derive teacher metadata from the first matching event.
      let teacher: any | null = null;
      if (teacherEvents.length > 0) {
        const et = teacherEvents[0].eventTeachers?.find(
          (e: any) => e.teacher?.abbreviation === abbreviation,
        );
        teacher = et?.teacher ?? null;
      }
      return { success: true, teacher, events: mappedEvents };
    }

    // 2. Cache miss — fall back to public events network path.
    const res = await this.getPublicEvents(opts);
    if (!res.success || !res.data) {
      return { success: false, teacher: null, events: [], error: res.error };
    }
    const eventsForTeacher = res.data.filter((ev: any) =>
      ev.teachers?.some((t: any) => t.abbreviation === abbreviation),
    );
    const teacher =
      eventsForTeacher[0]?.teachers?.find((t: any) => t.abbreviation === abbreviation) ?? null;
    return { success: true, teacher, events: eventsForTeacher };
  }

  // Get public events — cache-first (SWR pattern).
  // When the authenticated events cache is populated, derives public events
  // locally (audience.slug === "free-anyone"). Falls back to the unauthenticated
  // /events/public endpoint on cache miss, preserving behaviour for guests.
  async getPublicEvents(opts: { force?: boolean } = {}): Promise<{ success: boolean; data?: any[]; error?: string }> {
    // 1. Try cache first (skipped when force=true).
    const cachedEvents = opts.force ? null : await entityCacheService.getList<any>('events');
    if (cachedEvents !== null) {
      const publicRows = cachedEvents.filter(
        (ev: any) => ev.audience?.slug === 'free-anyone',
      );
      return { success: true, data: publicRows.map(mapEvent) };
    }

    // 2. Cache miss — fall back to the public (unauthenticated) endpoint.
    try {
      const response = await apiService.get<any[]>(API_ENDPOINTS.PUBLIC_EVENTS);
      if (response.success && response.data) {
        return { success: true, data: response.data.map(mapEvent) };
      }
      return { success: false, error: response.error || 'Failed to load public events' };
    } catch (error) {
      console.error('Error loading public events:', error);
      return { success: false, error: 'Failed to load public events' };
    }
  }

  // Get the featured event — cache-first (SWR pattern).
  // When the events cache is populated, finds the entry with the most recent
  // non-null featuredAt value. Falls back to /events/featured on cache miss.
  async getFeaturedEvent(opts: { force?: boolean } = {}): Promise<{ success: boolean; data?: any; error?: string }> {
    // 1. Try cache first (skipped when force=true).
    const cachedEvents = opts.force ? null : await entityCacheService.getList<any>('events');
    if (cachedEvents !== null) {
      // Find the event with the most recent featuredAt timestamp.
      let featured: any | null = null;
      for (const ev of cachedEvents) {
        if (!ev.featuredAt) continue;
        if (!featured || ev.featuredAt > featured.featuredAt) {
          featured = ev;
        }
      }
      return { success: true, data: featured ? mapEvent(featured) : null };
    }

    // 2. Cache miss — fall back to the public endpoint.
    try {
      const response = await apiService.get<any>(API_ENDPOINTS.FEATURED_EVENT);
      if (response.success && response.data) {
        return { success: true, data: mapEvent(response.data) };
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Error loading featured event:', error);
      return { success: false, error: 'Failed to load featured event' };
    }
  }

  // Get user's retreat groups and recent activity (cache-first / SWR pattern)
  async getUserRetreats(opts: { force?: boolean } = {}): Promise<{ success: boolean; data?: UserRetreatData; error?: string; authRequired?: boolean }> {
    // 1. Try cache first — return immediately on hit (skipped when force=true).
    if (!opts.force) {
      const [cachedGroups, cachedEvents] = await Promise.all([
        entityCacheService.getList<any>('groups'),
        entityCacheService.getList<any>('events'),
      ]);

      if (cachedGroups !== null && cachedEvents !== null) {
        return { success: true, data: this.assembleUserRetreats(cachedGroups, cachedEvents) };
      }
    }

    // 2. Cache miss — fetch from network (first launch / post-wipe).
    try {
      console.log('Fetching user groups and events...');

      const [groupsRes, eventsRes] = await Promise.all([
        apiService.get<any[]>(API_ENDPOINTS.GROUPS),
        apiService.get<any[]>(API_ENDPOINTS.EVENTS),
      ]);

      if (!groupsRes.success || !groupsRes.data) {
        if (groupsRes.authRequired) {
          return { success: false, error: groupsRes.error || 'Authentication required.', authRequired: true };
        }
        return { success: false, error: groupsRes.error || 'Failed to load groups' };
      }
      if (!eventsRes.success || !eventsRes.data) {
        if (eventsRes.authRequired) {
          return { success: false, error: eventsRes.error || 'Authentication required.', authRequired: true };
        }
        return { success: false, error: eventsRes.error || 'Failed to load events' };
      }

      await Promise.all([
        entityCacheService.setList('groups', groupsRes.data),
        entityCacheService.setList('events', eventsRes.data),
      ]);

      console.log(`Loaded ${groupsRes.data.length} groups, ${eventsRes.data.length} events`);
      return { success: true, data: this.assembleUserRetreats(groupsRes.data, eventsRes.data) };
    } catch (error) {
      console.error('getUserRetreats network failure:', error);
      return { success: false, error: 'No retreat data available. Please check your connection and try again.' };
    }
  }

  // Get detailed information about a specific retreat group (cache-first / SWR pattern).
  // `groupKey` may be a numeric id, abbreviation (case-insensitive), or slug —
  // the backend resolves all three. The groups list is matched the same way
  // so we can hydrate the metadata from cache.
  async getRetreatGroupDetails(groupKey: string, opts: { force?: boolean } = {}): Promise<{
    success: boolean;
    data?: RetreatGroupDetails;
    error?: string
  }> {
    // 1. Try cache first (skipped when force=true).
    const [cachedGroups, cachedEvents] = await Promise.all([
      opts.force ? Promise.resolve(null) : entityCacheService.getList<any>('groups'),
      opts.force ? Promise.resolve(null) : entityCacheService.getList<any>('events'),
    ]);

    if (cachedGroups !== null && cachedEvents !== null) {
      const backendGroup = cachedGroups.find((g: any) => this.groupMatchesKey(g, groupKey));
      const groupId = backendGroup?.id;
      const groupEvents = cachedEvents
        .filter((ev: any) =>
          ev.eventRetreatGroups?.some(
            (erg: any) => erg.retreatGroupId === groupId || erg.retreatGroup?.id === groupId
          )
        );
      const gatherings = groupEvents.map(mapEvent);
      return { success: true, data: this.assembleGroupDetails(backendGroup, gatherings, groupKey) };
    }

    // 2. Cache miss — fetch from network.
    try {
      console.log(`Fetching group ${groupKey} events...`);

      const [eventsRes, groupsRes] = await Promise.all([
        apiService.get<any[]>(API_ENDPOINTS.GROUP_EVENTS(groupKey)),
        apiService.get<any[]>(API_ENDPOINTS.GROUPS),
      ]);

      if (!eventsRes.success || !eventsRes.data) {
        return { success: false, error: eventsRes.error || 'Failed to load group events' };
      }

      const gatherings = eventsRes.data.map(mapEvent);
      const backendGroup = groupsRes.data?.find((g: any) => this.groupMatchesKey(g, groupKey));

      return { success: true, data: this.assembleGroupDetails(backendGroup, gatherings, groupKey) };
    } catch (error) {
      console.error('Get retreat group details error:', error);
      return { success: false, error: 'Failed to load retreat group details' };
    }
  }

  /**
   * Map and enrich a raw backend event response into the shape expected by
   * the retreat detail screen. This is the single source of truth for the
   * raw→mapped transformation so that both the cache-hit and cache-miss
   * paths return an identical shape.
   *
   * The cache always stores RAW backend data (matching what syncService
   * writes). Consumers always call assembleEventDetail on the way out.
   */
  private assembleEventDetail(rawData: any): any {
    const mapped = mapEvent(rawData);

    const retreatGroup = rawData.eventRetreatGroups?.[0]?.retreatGroup;

    const transcripts = rawData.transcripts?.map((tr: any) => ({
      id: tr.id,
      language: tr.language,
      pageCount: tr.pageCount || tr.page_count,
      updatedAt: tr.updatedAt || tr.updated_at || '',
      originalFilename: tr.originalFilename || tr.original_filename || '',
    })) || [];

    return {
      ...mapped,
      transcripts,
      retreat_group: retreatGroup ? {
        id: String(retreatGroup.id),
        name: retreatGroup.nameEn || retreatGroup.name_en || '',
        name_translations: {
          en: retreatGroup.nameEn || retreatGroup.name_en || '',
          ...(retreatGroup.namePt || retreatGroup.name_pt
            ? { pt: retreatGroup.namePt || retreatGroup.name_pt }
            : {}),
        },
        avatarUrl: retreatGroup.avatarUrl ?? null,
        heroUrl: retreatGroup.heroUrl ?? null,
        heroMobileUrl: retreatGroup.heroMobileUrl ?? null,
        heroFocalX: retreatGroup.heroFocalX ?? 50,
        heroFocalY: retreatGroup.heroFocalY ?? 50,
        heroScale: retreatGroup.heroScale ?? 100,
        avatarUpdatedAt: retreatGroup.avatarUpdatedAt ?? null,
        heroUpdatedAt: retreatGroup.heroUpdatedAt ?? null,
      } : undefined,
      // Pass through relatedPublications if present in the raw response.
      ...(rawData.relatedPublications !== undefined
        ? { relatedPublications: rawData.relatedPublications }
        : {}),
    };
  }

  // Get detailed information about a specific retreat/event (cache-first / SWR pattern).
  // Note: presigned audio/video URLs are NOT stored in event detail responses —
  // they are fetched on-demand via getAudioPresignedUrl / getSessionVideoPlaybackUrls.
  // So the full mapped event object is safe to cache.
  //
  // Contract: the cache always stores RAW backend data (consistent with what
  // syncService.syncNamespace writes). assembleEventDetail maps on every read,
  // so cache-hit and cache-miss both return the same mapped+enriched shape.
  async getRetreatDetails(retreatId: string, opts: { force?: boolean } = {}): Promise<{
    success: boolean;
    data?: any;
    error?: string
  }> {
    const numericId = Number(retreatId);

    // 1. Try cache first — map raw→frontend shape on read (skipped when force=true).
    if (!opts.force) {
      const cached = await entityCacheService.getDetail<any>('events', numericId);
      if (cached !== null) {
        return { success: true, data: this.assembleEventDetail(cached) };
      }
    }

    // 2. Cache miss — fetch from network.
    try {
      console.log(`Fetching event details for ID: ${retreatId}`);

      // Try authenticated endpoint first, fall back to public for unauthenticated users
      let response = await apiService.get<any>(API_ENDPOINTS.EVENT_DETAILS(retreatId));

      if (!response.success) {
        console.log('Auth event endpoint failed, trying public endpoint...');
        response = await apiService.get<any>(API_ENDPOINTS.PUBLIC_EVENT_DETAILS(retreatId));
      }

      if (response.success && response.data) {
        // Store RAW backend data so syncService and retreatService share the
        // same cache shape. assembleEventDetail handles the mapping on read.
        await entityCacheService.setDetail('events', numericId, response.data);
        const data = this.assembleEventDetail(response.data);
        console.log(`Loaded event details: ${data.name}`);
        return { success: true, data };
      } else {
        throw new Error(response.error || 'API request failed');
      }
    } catch (error) {
      console.error('getRetreatDetails network failure:', error);
      return { success: false, error: 'Retreat details not available. Please check your connection and try again.' };
    }
  }

  // Get detailed information about a specific session
  async getSessionDetails(sessionId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string
  }> {
    const cacheKey = `@session_cache:${sessionId}`;

    try {
      console.log(`Fetching session details for ID: ${sessionId}`);

      const response = await apiService.get<any>(API_ENDPOINTS.SESSION_DETAILS(sessionId));

      if (response.success && response.data) {
        const mapped = mapSession(response.data);

        // Add gathering (parent event) info
        const event = response.data.event;
        const data = {
          ...mapped,
          gathering: event ? {
            id: String(event.id),
            name: event.titleEn || event.title_en || '',
          } : undefined,
        };

        console.log(`Loaded session details: ${data.name}`);
        await this.setCachedData(cacheKey, data);
        return { success: true, data };
      } else {
        throw new Error(response.error || 'API request failed');
      }
    } catch (error) {
      console.error('Backend request failed:', error);

      const cachedData = await this.getCachedData<any>(cacheKey);
      if (cachedData) {
        console.log('Using cached session details');
        return { success: true, data: cachedData };
      }

      return { success: false, error: 'Session details not available. Please check your connection and try again.' };
    }
  }

  // Get detailed information about a specific track
  async getTrackDetails(trackId: string): Promise<{
    success: boolean;
    data?: Track;
    error?: string
  }> {
    try {
      console.log(`Fetching track details for ID: ${trackId}`);

      const response = await apiService.get<any>(API_ENDPOINTS.TRACK_DETAILS(trackId));

      if (!response.success || !response.data) {
        return { success: false, error: response.error || 'Failed to load track details' };
      }

      return { success: true, data: mapTrack(response.data) };
    } catch (error) {
      console.error('Get track details error:', error);
      return { success: false, error: 'Failed to load track details' };
    }
  }

  // Get presigned URL for audio file access
  async getAudioPresignedUrl(trackId: string): Promise<{
    success: boolean;
    url?: string;
    error?: string
  }> {
    try {
      // Backend returns { url, expiresIn } (not presigned_url)
      const response = await apiService.get<{ url: string; presigned_url?: string }>(
        API_ENDPOINTS.PRESIGNED_URL(trackId)
      );

      if (response.success && response.data) {
        const url = response.data.url || response.data.presigned_url;
        if (url) return { success: true, url };
      }

      return { success: false, error: response.error || 'Failed to get audio URL' };
    } catch (error) {
      console.error('Get presigned URL error:', error);
      return { success: false, error: 'Failed to get audio URL' };
    }
  }

  /**
   * Get token-signed Bunny Stream playback URLs for a session's video.
   * Returns the HLS playlist URL (for native expo-video), the iframe embed URL
   * (web fallback), the thumbnail/poster URL, the duration, and the unix-epoch
   * expiry. Returns success=false when the session has no attached video.
   */
  async getSessionVideoPlaybackUrls(sessionId: string): Promise<{
    success: boolean;
    /** Backend HLS proxy URL — primary playback path on every platform.
     *  Per-segment signed via short-lived MAT, full ABR, no shareable
     *  long-lived links. */
    proxyHls?: string;
    /** Bunny iframe embed — kept as a fallback / for environments where
     *  HLS via HTML5 video is unsupported. */
    iframe?: string;
    /** Direct Bunny HLS URL — exposed for diagnostics, not the primary
     *  playback path (sub-playlists 403 with token auth on). */
    hls?: string;
    thumbnail?: string;
    durationSeconds?: number | null;
    expiresAt?: number;
    error?: string;
  }> {
    try {
      const response = await apiService.get<{
        proxyHls: string;
        iframe: string;
        hls: string;
        thumbnail: string;
        durationSeconds: number | null;
        expiresAt: number;
      }>(API_ENDPOINTS.VIDEO_SESSION_URL(sessionId));

      if (response.success && response.data) {
        return {
          success: true,
          proxyHls: response.data.proxyHls,
          iframe: response.data.iframe,
          hls: response.data.hls,
          thumbnail: response.data.thumbnail,
          durationSeconds: response.data.durationSeconds,
          expiresAt: response.data.expiresAt,
        };
      }
      return { success: false, error: response.error || 'Failed to get video URL' };
    } catch (error) {
      console.error('Get session video URL error:', error);
      return { success: false, error: 'Failed to get video URL' };
    }
  }

  /**
   * Fetch Read Along alignment data for a track.
   * The API proxies the JSON from S3 to avoid CORS issues on web.
   */
  async getReadAlongData(trackId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await apiService.get<any>(
        API_ENDPOINTS.READ_ALONG_URL(trackId)
      );
      if (response.success && response.data?.clean_segments) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error || 'Read Along not available' };
    } catch (error) {
      console.error('Get Read Along data error:', error);
      return { success: false, error: 'Failed to get Read Along data' };
    }
  }

  /**
   * Get a URL to view a watermarked transcript PDF.
   * - Web: returns direct API URL with token param (iframe gets proper Content-Disposition/filename)
   * - Native: fetches PDF, caches locally, returns file:// URI
   */
  async getTranscriptPdfUrl(transcriptId: string, updatedAt: string, originalFilename?: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const apiUrl = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.TRANSCRIPT_URL(transcriptId)}`;

      // Web: point iframe directly at API URL with token (gets correct filename from headers)
      if (Platform.OS === 'web') {
        if (!token) return { success: false, error: 'Authentication required' };
        return { success: true, url: `${apiUrl}?token=${encodeURIComponent(token)}` };
      }

      // Native: check cache first
      const { transcriptCacheService } = await import('./transcriptCacheService');
      const cached = await transcriptCacheService.getCached(transcriptId, updatedAt, originalFilename);
      if (cached) {
        return { success: true, url: cached };
      }

      // Fetch watermarked PDF from backend
      const response = await fetch(apiUrl, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { success: false, error: errorText || `HTTP ${response.status}` };
      }

      // Extract filename from Content-Disposition header if not provided
      let filename = originalFilename;
      if (!filename) {
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }

      const pdfBytes = await response.arrayBuffer();

      // Cache and return local file URI
      const localUrl = await transcriptCacheService.cache(transcriptId, updatedAt, pdfBytes, filename);
      return { success: true, url: localUrl };
    } catch (error) {
      console.error('Get transcript PDF error:', error);
      return { success: false, error: 'Failed to load transcript' };
    }
  }

  // Stream track — uses same presigned URL endpoint
  async getTrackStreamUrl(trackId: string): Promise<{
    success: boolean;
    url?: string;
    error?: string
  }> {
    return this.getAudioPresignedUrl(trackId);
  }

  // Check if track download is in progress
  isTrackDownloading(trackId: string): boolean {
    return this.activeDownloads.has(trackId);
  }

  // Cancel track download
  async cancelTrackDownload(trackId: string): Promise<boolean> {
    const download = this.activeDownloads.get(trackId);
    if (download) {
      try {
        this.cancelledDownloads.add(trackId);
        await download.pauseAsync();
        this.activeDownloads.delete(trackId);
        console.log(`Cancelled download for track: ${trackId}`);
        return true;
      } catch (error) {
        console.error(`Error cancelling download for track ${trackId}:`, error);
        this.cancelledDownloads.delete(trackId);
        return false;
      }
    }
    return false;
  }

  // Download track for offline playback
  async downloadTrack(trackId: string, onProgress?: (progress: number) => void): Promise<{
    success: boolean;
    localPath?: string;
    error?: string;
    cancelled?: boolean;
  }> {
    try {
      if (this.activeDownloads.has(trackId)) {
        return { success: false, error: 'Download already in progress' };
      }

      const streamResult = await this.getTrackStreamUrl(trackId);
      if (!streamResult.success || !streamResult.url) {
        return { success: false, error: streamResult.error || 'Failed to get stream URL' };
      }

      const tracksDir = `${FileSystem.documentDirectory}tracks/`;
      const dirInfo = await FileSystem.getInfoAsync(tracksDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(tracksDir, { intermediates: true });
      }

      const localPath = `${tracksDir}${trackId}.mp3`;

      const downloadResumable = FileSystem.createDownloadResumable(
        streamResult.url,
        localPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          onProgress?.(progress * 100);
        }
      );

      this.activeDownloads.set(trackId, downloadResumable);
      const downloadResult = await downloadResumable.downloadAsync();

      if (!downloadResult) {
        if (this.cancelledDownloads.has(trackId)) {
          this.cancelledDownloads.delete(trackId);
          return { success: false, cancelled: true };
        }
        return { success: false, error: 'Download failed - no result' };
      }

      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      const fileSize = fileInfo.exists ? fileInfo.size || 0 : 0;

      await this.setCachedData(`@download:${trackId}`, {
        trackId,
        localPath: downloadResult.uri,
        downloadedAt: Date.now(),
        size: fileSize,
      });

      this.activeDownloads.delete(trackId);
      this.cancelledDownloads.delete(trackId);

      return { success: true, localPath: downloadResult.uri };
    } catch (error: any) {
      this.activeDownloads.delete(trackId);

      if (this.cancelledDownloads.has(trackId)) {
        this.cancelledDownloads.delete(trackId);
        return { success: false, cancelled: true };
      }

      if (error.message && error.message.includes('cancelled')) {
        return { success: false, error: 'Download cancelled', cancelled: true };
      }

      return { success: false, error: 'Failed to download track' };
    }
  }

  // Check if track is downloaded and valid
  async isTrackDownloaded(trackId: string): Promise<boolean> {
    try {
      const downloadInfo = await this.getCachedData<{localPath: string, size: number}>(`@download:${trackId}`);
      if (!downloadInfo) return false;

      const fileInfo = await FileSystem.getInfoAsync(downloadInfo.localPath);
      if (!fileInfo.exists) {
        await AsyncStorage.removeItem(`@download:${trackId}`);
        return false;
      }

      const fileSize = fileInfo.size || 0;
      if (fileSize < 10000) {
        try {
          const fileContent = await FileSystem.readAsStringAsync(downloadInfo.localPath, { length: 200 });
          if (fileContent.includes('<?xml') && fileContent.includes('<Error>')) {
            await this.removeDownloadedTrack(trackId);
            return false;
          }
        } catch {
          // Ignore read errors during validation
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking if track is downloaded:', error);
      return false;
    }
  }

  // Get local path for downloaded track
  async getDownloadedTrackPath(trackId: string): Promise<string | null> {
    try {
      const downloadInfo = await this.getCachedData<{localPath: string}>(`@download:${trackId}`);
      return downloadInfo?.localPath || null;
    } catch {
      return null;
    }
  }

  // Remove downloaded track
  async removeDownloadedTrack(trackId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const localPath = await this.getDownloadedTrackPath(trackId);
      if (localPath) {
        const fileInfo = await FileSystem.getInfoAsync(localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(localPath);
        }
      }
      await AsyncStorage.removeItem(`@download:${trackId}`);
      return { success: true };
    } catch (error) {
      console.error('Remove download error:', error);
      return { success: false, error: 'Failed to remove download' };
    }
  }

  // No-op: legacy retreat cache is superseded by entityCacheService.
  // Kept for compatibility; cache invalidation is now handled by syncService.
  async clearAllCache(): Promise<void> {
    // No-op — entityCacheService invalidation is handled by syncService
  }

  // Clear all downloads and clean up files
  async clearAllDownloads(): Promise<{ success: boolean; removedCount: number; error?: string }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const downloadKeys = keys.filter(key => key.startsWith('@download:'));
      let removedCount = 0;

      for (const key of downloadKeys) {
        try {
          const trackId = key.replace('@download:', '');
          const result = await this.removeDownloadedTrack(trackId);
          if (result.success) removedCount++;
        } catch (error) {
          console.warn(`Failed to remove download for key ${key}:`, error);
        }
      }

      return { success: true, removedCount };
    } catch (error) {
      console.error('Error clearing all downloads:', error);
      return { success: false, removedCount: 0, error: 'Failed to clear downloads' };
    }
  }

  // Search events and sessions by query
  async search(query: string, lang?: string): Promise<{
    success: boolean;
    data?: SearchResponse;
    error?: string;
  }> {
    try {
      const response = await apiService.get<SearchResponse>(
        API_ENDPOINTS.SEARCH(query, lang),
      );
      if (response.success && response.data) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error || 'Search failed' };
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, error: 'Search failed' };
    }
  }

  // Force clear all download tracking entries (for development)
  async forceClearAllRetreatCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const downloadKeys = keys.filter(key => key.startsWith('@download:'));
      if (downloadKeys.length > 0) {
        await AsyncStorage.multiRemove(downloadKeys);
      }
    } catch (error) {
      console.error('Error force clearing cache:', error);
    }
  }
}

export default RetreatService.getInstance();
