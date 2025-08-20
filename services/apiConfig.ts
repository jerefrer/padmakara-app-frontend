// API Configuration for Padmakara Backend Integration

const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api'  // Django development server
  : 'https://api.padmakara.app/api'; // Production API

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 15000, // 15 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

export const API_ENDPOINTS = {
  // Magic Link Authentication
  REQUEST_MAGIC_LINK: '/auth/request-magic-link/',
  REQUEST_USER_APPROVAL: '/auth/request-approval/',
  AUTO_ACTIVATE_DEVICE: '/auth/auto-activate/',
  DISCOVER_DEVICE_ACTIVATION: '/auth/device/discover/',
  DEACTIVATE_DEVICE: '/auth/device/deactivate/',
  LIST_USER_DEVICES: '/auth/devices/',
  
  
  // User Profile
  USER_PROFILE: '/auth/user/',
  UPDATE_PROFILE: '/auth/user/',
  USER_PREFERENCES: '/auth/user/preferences/',
  
  // Retreat Groups & Content
  RETREAT_GROUPS: '/retreats/groups/',
  USER_RETREATS: '/retreats/user-retreats/',
  RETREAT_DETAILS: (id: string) => `/retreats/groups/${id}/`,
  GATHERING_DETAILS: (id: string) => `/retreats/gatherings/${id}/`,
  SESSION_DETAILS: (id: string) => `/retreats/sessions/${id}/`,
  TRACK_DETAILS: (id: string) => `/retreats/tracks/${id}/`,
  
  // User Progress & Content
  USER_PROGRESS: '/content/progress/',
  TRACK_PROGRESS: (trackId: string) => `/content/progress/${trackId}/`,
  BOOKMARKS: '/content/bookmarks/',
  TRACK_BOOKMARKS: (trackId: string) => `/content/bookmarks/?track=${trackId}`,
  PDF_HIGHLIGHTS: '/content/pdf-highlights/',
  USER_NOTES: '/content/notes/',
  DOWNLOADED_CONTENT: '/content/downloads/',
  
  // Audio & File Access
  PRESIGNED_URL: (trackId: string) => `/content/presigned-url/${trackId}/`,
  TRANSCRIPT_URL: (trackId: string) => `/content/transcript-url/${trackId}/`,
};

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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
  return `${API_CONFIG.baseURL}${endpoint}`;
};

// Helper function to get auth headers
export const getAuthHeaders = (token: string) => ({
  ...API_CONFIG.headers,
  'Authorization': `Bearer ${token}`,
});

export default API_CONFIG;