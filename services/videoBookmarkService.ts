import apiService from './apiService';
import { API_ENDPOINTS } from './apiConfig';

export interface VideoBookmarkEvent {
  id: number;
  titleEn: string;
  titlePt: string | null;
  startDate: string | null;
  endDate: string | null;
  teachers: { name: string; abbreviation: string; avatarUrl?: string | null; photoUrl?: string | null }[];
}

export interface VideoBookmarkVideo {
  id: number;
  eventId: number;
  position: number;
  titleEn: string | null;
  titlePt: string | null;
  videoDate: string | null;
  durationSeconds: number | null;
  event: VideoBookmarkEvent;
}

export interface VideoBookmark {
  id: number;
  videoId: number;
  positionSeconds: number;
  note: string | null;
  createdAt: string;
  video: VideoBookmarkVideo;
}

export interface AddVideoBookmarkInput {
  videoId: number;
  positionSeconds: number;
  note?: string;
  /** Original date of a bookmark uploaded from the device. */
  createdAt?: string;
}

interface RawVideoBookmark {
  id: number;
  videoId: number;
  positionSeconds: number;
  note?: string | null;
  createdAt: string;
  video?: any;
}

function toBookmark(raw: RawVideoBookmark): VideoBookmark {
  const video = raw.video || {};
  const event = video.event || {};

  return {
    id: raw.id,
    videoId: raw.videoId,
    positionSeconds: raw.positionSeconds,
    note: raw.note ?? null,
    createdAt: raw.createdAt,
    video: {
      id: video.id ?? raw.videoId,
      eventId: video.eventId ?? event.id,
      position: video.position ?? 0,
      titleEn: video.titleEn ?? null,
      titlePt: video.titlePt ?? null,
      videoDate: video.videoDate ?? null,
      durationSeconds: video.durationSeconds ?? null,
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

class VideoBookmarkService {
  private static instance: VideoBookmarkService;

  static getInstance(): VideoBookmarkService {
    if (!VideoBookmarkService.instance) {
      VideoBookmarkService.instance = new VideoBookmarkService();
    }
    return VideoBookmarkService.instance;
  }

  async list(): Promise<{ success: boolean; data?: VideoBookmark[]; error?: string; authRequired?: boolean }> {
    const res = await apiService.get<RawVideoBookmark[]>(API_ENDPOINTS.VIDEO_BOOKMARKS);
    if (!res.success || !res.data) {
      return { success: false, error: res.error, authRequired: res.authRequired };
    }
    return { success: true, data: res.data.map(toBookmark) };
  }

  async add(input: AddVideoBookmarkInput): Promise<{ success: boolean; data?: VideoBookmark; error?: string }> {
    const body: AddVideoBookmarkInput = {
      videoId: input.videoId,
      positionSeconds: Math.floor(input.positionSeconds),
    };
    if (input.note) body.note = input.note;
    if (input.createdAt) body.createdAt = input.createdAt;

    const res = await apiService.post<RawVideoBookmark>(API_ENDPOINTS.VIDEO_BOOKMARKS, body);
    if (!res.success || !res.data) {
      return { success: false, error: res.error };
    }
    return { success: true, data: toBookmark(res.data) };
  }

  async updateNote(id: number, note: string | null): Promise<{ success: boolean; error?: string }> {
    const res = await apiService.patch(API_ENDPOINTS.VIDEO_BOOKMARK_DETAIL(id), { note });
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true };
  }

  async remove(id: number): Promise<{ success: boolean; error?: string }> {
    const res = await apiService.delete(API_ENDPOINTS.VIDEO_BOOKMARK_DETAIL(id));
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true };
  }
}

export default VideoBookmarkService.getInstance();
