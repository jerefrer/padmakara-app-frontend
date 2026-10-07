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
    cancelledAt?: string | null;
    amount?: number | null;
    hasAccess?: boolean;
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
  avatarUrl?: string | null;
  /** Desktop hero (2400px wide). Falls back to heroMobileUrl on small screens. */
  heroUrl?: string | null;
  /** Mobile hero variant (1200px wide); preferred by phone-sized clients. */
  heroMobileUrl?: string | null;
  heroFocalX?: number;
  heroFocalY?: number;
  heroScale?: number;
  avatarUpdatedAt?: string | null;
  heroUpdatedAt?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GatheringTeacher {
  id?: number;
  name: string;
  abbreviation: string;
  photoUrl?: string | null;
  avatarUrl?: string | null;
  /** Desktop hero (2400px wide). */
  heroUrl?: string | null;
  /** Mobile hero variant (1200px wide). */
  heroMobileUrl?: string | null;
  heroFocalX?: number;
  heroFocalY?: number;
  heroScale?: number;
  avatarUpdatedAt?: string | null;
  heroUpdatedAt?: string | null;
}

export interface EventType {
  id: number;
  nameEn: string;
  namePt?: string;
  abbreviation: string;
  slug: string;
}

export interface GatheringPlace {
  id: number;
  name: string;
  abbreviation?: string | null;
  location?: string | null;
}

export interface GatheringGroup {
  id: number;
  name: string;
  abbreviation?: string | null;
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
  teachers?: GatheringTeacher[];
  places?: GatheringPlace[];
  retreatGroups?: GatheringGroup[];
  eventType?: EventType;
  transcripts?: { id: number }[];
  /** Non-transcript documents attached to this event (images, slides, etc.),
   *  visible to users alongside the transcript. */
  eventFiles?: EventFile[];
  /** Video recordings attached to this event, ordered by `position`.
   *  An event may have zero, one, or several videos. */
  videos?: EventVideo[];
  status: 'draft' | 'upcoming' | 'ongoing' | 'completed';
  created_at: string;
  updated_at: string;
}

/** A single non-transcript document attached to an event (image, slides,
 *  or other document type), served via GET /api/media/file/:id. */
export interface EventFile {
  id: number;
  title?: string | null;
  originalFilename: string;
  fileType: string;
  extension: string;
  language?: string | null;
  sensitive?: boolean;
  sortOrder?: number;
}

/** A single item in the merged "Documents" list for an event — either the
 *  transcript (pinned first, featured) or one of the event's other files. */
export interface EventDocument {
  key: string;
  kind: 'transcript' | 'file';
  id: number;
  title: string;
  language?: string | null;
  extension: string;
  viewer: 'pdf' | 'image' | 'download';
  featured: boolean;
}

export interface Session {
  id: string;
  name: string;
  name_translations?: Record<string, string>;
  /** Time of day the session was recorded. Mirrors the API's free-text
   *  `time_period` column, normalized by retreatService.mapSession(); anything
   *  unrecognized (including null) becomes 'other', which the UI renders
   *  without a period label. */
  type: 'morning' | 'afternoon' | 'evening' | 'full_day' | 'other';
  partNumber?: number | null;
  date: string;
  tracks?: Track[];
  gathering_id: string;
  created_at: string;
  updated_at: string;
}

/** A single Bunny Stream video recording attached to an event (not a
 *  session — videos are event-level content). */
export interface EventVideo {
  id: number;
  eventId: number;
  bunnyVideoId: string;
  position: number;
  titleEn: string | null;
  titlePt: string | null;
  /** "YYYY-MM-DD", or null when not set. */
  videoDate: string | null;
  durationSeconds: number | null;
  posterUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Track {
  id: string;
  title: string;
  title_translations?: { en?: string; pt?: string }; // combined multi-language tracks
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
  lastRead: string;
}

// ─── Publications ───────────────────────────────────────────────────

export interface Publication {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  authors: string[];
  language: string;
  pageCount: number | null;
  publicationDate: string | null;
  version: string | null;
  fileSizeBytes: number | null;
  accessLevel: 'public' | 'subscribers';
  updatedAt: string;
  coverImageUrl: string | null;
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