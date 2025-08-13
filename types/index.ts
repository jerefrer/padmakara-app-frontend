export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  dharma_name?: string;
  retreat_groups?: string[];
  preferences: {
    language: 'en' | 'pt';
    contentLanguage: 'en' | 'en-pt';
    biometricEnabled: boolean;
    notifications: boolean;
  };
  subscription: {
    status: 'active' | 'inactive' | 'expired';
    plan: 'basic' | 'premium' | 'lifetime';
    expiresAt: string;
  };
  created_at: string;
  last_login: string;
}

export interface RetreatGroup {
  id: string;
  name: string;
  description: string;
  gatherings?: Gathering[];
  members?: string[];
  created_at: string;
  updated_at: string;
}

export interface Gathering {
  id: string;
  name: string;
  season: 'spring' | 'fall';
  year: number;
  startDate: string;
  endDate: string;
  sessions?: Session[];
  status: 'draft' | 'upcoming' | 'ongoing' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  name: string;
  type: 'morning' | 'evening' | 'other';
  date: string;
  tracks?: Track[];
  gathering_id: string;
  created_at: string;
  updated_at: string;
}

export interface Track {
  id: string;
  title: string;
  duration: number; // in seconds
  file_size?: number; // in bytes
  audio_file?: string;
  transcript_file?: string;
  order: number;
  session_id: string;
  created_at: string;
  updated_at: string;
}

export interface UserProgress {
  trackId: string;
  position: number; // in seconds
  completed: boolean;
  lastPlayed: string;
  bookmarks: Bookmark[];
}

export interface Bookmark {
  id: string;
  trackId: string;
  position: number;
  note?: string;
  createdAt: string;
}

export interface DownloadedContent {
  id: string;
  type: 'audio' | 'transcript';
  trackId: string;
  localPath: string;
  downloadedAt: string;
  size: number; // in bytes
}

export interface PDFProgress {
  transcriptId: string;
  page: number;
  highlights: PDFHighlight[];
  lastRead: string;
}

export interface PDFHighlight {
  id: string;
  page: number;
  text: string;
  color: string;
  createdAt: string;
}