import apiService from './apiService';
import { API_ENDPOINTS } from './apiConfig';
import { mapEvent } from './retreatService';
import type { Gathering } from '@/types';

export interface EventBookmark {
  id: number;
  eventId: number;
  createdAt: string;
  event: Gathering;
}

interface RawEventBookmark {
  id: number;
  eventId: number;
  createdAt: string;
  event: any;
}

function toBookmark(raw: RawEventBookmark): EventBookmark {
  return {
    id: raw.id,
    eventId: raw.eventId,
    createdAt: raw.createdAt,
    event: mapEvent(raw.event),
  };
}

class EventBookmarkService {
  private static instance: EventBookmarkService;

  static getInstance(): EventBookmarkService {
    if (!EventBookmarkService.instance) {
      EventBookmarkService.instance = new EventBookmarkService();
    }
    return EventBookmarkService.instance;
  }

  async list(): Promise<{ success: boolean; data?: EventBookmark[]; error?: string; authRequired?: boolean }> {
    const res = await apiService.get<RawEventBookmark[]>(API_ENDPOINTS.EVENT_BOOKMARKS);
    if (!res.success || !res.data) {
      return { success: false, error: res.error, authRequired: res.authRequired };
    }
    return { success: true, data: res.data.map(toBookmark) };
  }

  async add(eventId: string | number): Promise<{ success: boolean; data?: EventBookmark; error?: string }> {
    const res = await apiService.post<RawEventBookmark>(API_ENDPOINTS.EVENT_BOOKMARKS, {
      eventId: typeof eventId === 'string' ? parseInt(eventId, 10) : eventId,
    });
    if (!res.success || !res.data) {
      return { success: false, error: res.error };
    }
    return { success: true, data: toBookmark(res.data) };
  }

  async remove(eventId: string | number): Promise<{ success: boolean; error?: string }> {
    const res = await apiService.delete(API_ENDPOINTS.EVENT_BOOKMARK_DETAIL(String(eventId)));
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true };
  }
}

export default EventBookmarkService.getInstance();
