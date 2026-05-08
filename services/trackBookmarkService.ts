import apiService from './apiService';
import { API_ENDPOINTS } from './apiConfig';

export interface TrackBookmarkEvent {
  id: number;
  titleEn: string;
  titlePt: string | null;
  startDate: string | null;
  endDate: string | null;
  teachers: { name: string; abbreviation: string; avatarUrl?: string | null; photoUrl?: string | null }[];
}

export interface TrackBookmarkSession {
  id: number;
  titleEn: string | null;
  titlePt: string | null;
  sessionDate: string | null;
}

export interface TrackBookmarkTrack {
  id: number;
  title: string;
  trackNumber: number;
  durationSeconds: number;
  session: TrackBookmarkSession;
  event: TrackBookmarkEvent;
}

export interface TrackBookmark {
  id: number;
  trackId: number;
  createdAt: string;
  track: TrackBookmarkTrack;
}

interface RawTrackBookmark {
  id: number;
  trackId: number;
  createdAt: string;
  track: any;
}

function toBookmark(raw: RawTrackBookmark): TrackBookmark {
  const track = raw.track || {};
  const session = track.session || {};
  const event = session.event || {};

  return {
    id: raw.id,
    trackId: raw.trackId,
    createdAt: raw.createdAt,
    track: {
      id: track.id,
      title: track.title || '',
      trackNumber: track.trackNumber || 0,
      durationSeconds: track.durationSeconds || 0,
      session: {
        id: session.id,
        titleEn: session.titleEn ?? null,
        titlePt: session.titlePt ?? null,
        sessionDate: session.sessionDate ?? null,
      },
      event: {
        id: event.id,
        titleEn: event.titleEn || '',
        titlePt: event.titlePt ?? null,
        startDate: event.startDate ?? null,
        endDate: event.endDate ?? null,
        teachers: (event.eventTeachers || [])
          .map((et: any) => ({
            name: et.teacher?.name || '',
            abbreviation: et.teacher?.abbreviation || '',
            avatarUrl: et.teacher?.avatarUrl ?? null,
            photoUrl: et.teacher?.photoUrl ?? null,
          }))
          .filter((tt: any) => tt.name),
      },
    },
  };
}

class TrackBookmarkService {
  private static instance: TrackBookmarkService;

  static getInstance(): TrackBookmarkService {
    if (!TrackBookmarkService.instance) {
      TrackBookmarkService.instance = new TrackBookmarkService();
    }
    return TrackBookmarkService.instance;
  }

  async list(): Promise<{ success: boolean; data?: TrackBookmark[]; error?: string; authRequired?: boolean }> {
    const res = await apiService.get<RawTrackBookmark[]>(API_ENDPOINTS.TRACK_BOOKMARKS_V2);
    if (!res.success || !res.data) {
      return { success: false, error: res.error, authRequired: res.authRequired };
    }
    return { success: true, data: res.data.map(toBookmark) };
  }

  async add(trackId: string | number): Promise<{ success: boolean; data?: TrackBookmark; error?: string }> {
    const res = await apiService.post<RawTrackBookmark>(API_ENDPOINTS.TRACK_BOOKMARKS_V2, {
      trackId: typeof trackId === 'string' ? parseInt(trackId, 10) : trackId,
    });
    if (!res.success || !res.data) {
      return { success: false, error: res.error };
    }
    return { success: true, data: toBookmark(res.data) };
  }

  async remove(trackId: string | number): Promise<{ success: boolean; error?: string }> {
    const res = await apiService.delete(API_ENDPOINTS.TRACK_BOOKMARK_DETAIL(String(trackId)));
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true };
  }
}

export default TrackBookmarkService.getInstance();
