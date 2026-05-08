// API Configuration for Padmakara Backend Integration

// API base URL — MUST be set via EXPO_PUBLIC_API_URL in .env
// Development: http://localhost:3000/api
// Production:  https://api.your-domain.com/api
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  timeout: 15000, // 15 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

export const API_ENDPOINTS = {
  // Magic Link Authentication
  REQUEST_MAGIC_LINK: '/auth/request-magic-link',
  REQUEST_USER_APPROVAL: '/auth/request-approval',
  AUTO_ACTIVATE_DEVICE: '/auth/auto-activate',
  DISCOVER_DEVICE_ACTIVATION: '/auth/device/discover',
  DEACTIVATE_DEVICE: '/auth/device/deactivate',
  LIST_USER_DEVICES: '/auth/devices',
  REFRESH_TOKEN: '/auth/refresh',

  // User Profile
  USER_PROFILE: '/auth/user',
  UPDATE_PROFILE: '/auth/user',
  USER_PREFERENCES: '/auth/user/preferences',
  
  // Public Events (no auth required)
  PUBLIC_EVENTS: '/events/public',
  PUBLIC_EVENT_DETAILS: (id: string) => `/events/public/${id}`,
  FEATURED_EVENT: '/events/featured',

  // Groups & Events
  GROUPS: '/groups',
  GROUP_EVENTS: (id: string) => `/groups/${id}/events`,
  EVENTS: '/events',
  EVENT_DETAILS: (id: string) => `/events/${id}`,
  SESSION_DETAILS: (id: string) => `/events/sessions/${id}`,
  TRACK_DETAILS: (id: string) => `/events/tracks/${id}`,
  
  // User Progress & Content
  USER_PROGRESS: '/content/progress',
  TRACK_PROGRESS: (trackId: string) => `/content/progress/${trackId}`,
  BOOKMARKS: '/content/bookmarks',
  TRACK_BOOKMARKS: (trackId: string) => `/content/bookmarks?track=${trackId}`,
  EVENT_BOOKMARKS: '/content/event-bookmarks',
  EVENT_BOOKMARK_DETAIL: (eventId: string) => `/content/event-bookmarks/${eventId}`,
  TRACK_BOOKMARKS_V2: '/content/track-bookmarks',
  TRACK_BOOKMARK_DETAIL: (trackId: string) => `/content/track-bookmarks/${trackId}`,
  PDF_HIGHLIGHTS: '/content/pdf-highlights',
  USER_NOTES: '/content/notes',
  DOWNLOADED_CONTENT: '/content/downloads',
  
  // Audio & File Access (Media endpoints)
  PRESIGNED_URL: (trackId: string) => `/media/audio/${trackId}`,
  /** Session-scoped video — there's at most one video per session. */
  VIDEO_SESSION_URL: (sessionId: string) => `/media/video/session/${sessionId}`,
  VIDEO_SESSION_DOWNLOAD_URL: (sessionId: string) => `/media/video/session/${sessionId}/download`,
  /** Cross-device watched-position storage for session videos. */
  VIDEO_PROGRESS: (sessionId: string) => `/content/video-progress/${sessionId}`,
  READ_ALONG_URL: (trackId: string) => `/media/readalong/${trackId}`,
  TRANSCRIPT_URL: (transcriptId: string) => `/media/transcript/${transcriptId}`,
  
  // Account Management
  DELETE_ACCOUNT: '/auth/user/delete',

  // Payment / Subscription
  PAYMENT_SUBSCRIBE: '/payment/subscribe',
  PAYMENT_CANCEL: '/payment/cancel',

  // Search
  SEARCH: (query: string, lang?: string) => `/search?q=${encodeURIComponent(query)}${lang ? `&lang=${lang}` : ''}`,

  // Publications
  PUBLICATIONS: '/publications',
  PUBLICATION_PDF: (id: string) => `/publications/${id}/pdf`,

  // ZIP Download Endpoints
  PUBLIC_EVENT_DOWNLOAD_REQUEST: (eventId: string) => `/events/public/${eventId}/request-download`,
  EVENT_DOWNLOAD_REQUEST: (eventId: string) => `/events/${eventId}/request-download`,
  DOWNLOAD_STATUS: (requestId: string) => `/download-requests/${requestId}/status`,
  DOWNLOAD_FILE: (requestId: string) => `/download-requests/${requestId}/download`,
};

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  // True when the request failed because the user's session is no longer
  // valid (401 after token refresh attempt, or no token present on an
  // auth-required endpoint). Screens can use this to show a "sign in"
  // state instead of a generic connection error.
  authRequired?: boolean;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

// Error types that can be returned from the API
export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

// Helper function to build full API URL
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to get auth headers
export const getAuthHeaders = async () => {
  try {
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    const token = await AsyncStorage.default.getItem('auth_token');
    
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    return {
      ...API_CONFIG.headers,
      'Authorization': `Bearer ${token}`,
    };
  } catch (error) {
    console.error('Error getting auth headers:', error);
    throw error;
  }
};

export default API_CONFIG;