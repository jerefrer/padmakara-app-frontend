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
    status: 'active' | 'expired' | 'none';
    source: string | null;
    expiresAt: string | null;
  };
  created_at: string;
  last_login: string;
}

export interface RetreatGroup {
  id: string;
  name: string;
  name_translations?: Record<string, string>;
  abbreviation?: string;
  gatherings?: Gathering[];
  members?: string[];
  created_at: string;
  updated_at: string;
}

export interface Gathering {
  id: string;
  name: string;
  name_translations?: Record<string, string>;
  main_topics_translations?: Record<string, string>;
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
  name_translations?: Record<string, string>;
  type: 'morning' | 'afternoon' | 'evening' | 'other';
  partNumber?: number | null;
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
  language?: string; // deprecated — use originalLanguage
  languages?: string[]; // All languages in the track (e.g., ['en', 'pt'] for combo)
  originalLanguage?: string; // The track's own primary language
  speaker?: string; // Teacher abbreviation (e.g., 'JKR')
  speakerName?: string; // Teacher full name (e.g., 'Jigme Khyentse Rinpoche')
  isOriginal?: boolean; // True if original track, false if translation
  isPractice?: boolean; // True if practice/meditation track (displays first in session)
  hasReadAlong?: boolean; // Whether Read Along alignment data exists for this track
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

// ─── Read Along ─────────────────────────────────────────────────────

export interface ReadAlongWord {
  word: string;
  start: number; // seconds
  end: number;   // seconds
  confidence: 'high' | 'medium' | 'low';
}

export interface ReadAlongSegment {
  text: string;
  start: number; // seconds
  end: number;   // seconds
  confidence: 'high' | 'medium' | 'low';
  words: ReadAlongWord[];
}

export interface ReadAlongData {
  clean_segments: ReadAlongSegment[];
  stats: {
    clean_words: number;
    words_high: number;
    words_medium: number;
    words_low: number;
    usable_pct: number;
  };
}

// ─── Downloads ──────────────────────────────────────────────────────

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

// ─── Search ──────────────────────────────────────────────────────────

export interface SearchResultSession {
  id: number;
  titleEn: string | null;
  titlePt: string | null;
  sessionDate: string | null;
  timePeriod: string | null;
  sessionNumber: number;
  score: number;
  matchedFields: string[];
  matchedTracks: { id: number; title: string }[];
}

export interface SearchResultEvent {
  event: {
    id: number;
    titleEn: string;
    titlePt: string | null;
    startDate: string | null;
    endDate: string | null;
    teachers: string[];
  };
  sessions: SearchResultSession[];
  snippets: { field: string; text: string }[];
  totalScore: number;
}

export interface SearchResponse {
  results: SearchResultEvent[];
  totalResults: number;
  query: string;
}