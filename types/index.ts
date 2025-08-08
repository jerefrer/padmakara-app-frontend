export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  retreatGroups?: string[];
  preferences: {
    language: 'en' | 'pt';
    contentLanguage: 'en' | 'en-pt';
    biometricEnabled: boolean;
    notifications: boolean;
  };
  subscription: {
    status: 'active' | 'inactive' | 'expired';
    plan: 'basic' | 'premium';
    expiresAt: string;
  };
  createdAt: string;
  lastLogin: string;
}

export interface RetreatGroup {
  id: string;
  name: string;
  description: string;
  gatherings: Gathering[];
  members: string[];
}

export interface Gathering {
  id: string;
  name: string;
  season: 'spring' | 'fall';
  year: number;
  startDate: string;
  endDate: string;
  sessions: Session[];
}

export interface Session {
  id: string;
  name: string;
  type: 'morning' | 'evening';
  date: string;
  tracks: Track[];
}

export interface Track {
  id: string;
  title: string;
  duration: number; // in seconds
  audioUrl: string;
  transcriptUrl: string;
  order: number;
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