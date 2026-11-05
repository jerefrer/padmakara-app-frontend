/**
 * The topics of an event as the Topics tab shows them. The text stays as the
 * admin entered it, line breaks included; only the "[Audio tracks 001-006]"
 * marker is taken out, because the tab turns it into a link to those tracks.
 */
export interface TrackRange {
  start: number;
  end: number;
}

export interface SessionTopicsBlock {
  text: string;
  trackRange: TrackRange | null;
}

export interface EventTopicsContent {
  main: string | null;
  sessions: SessionTopicsBlock[];
  hasContent: boolean;
}

const TRACK_MARKER = /\[\s*(?:audio\s+tracks?|faixas?\s+de\s+[aá]udio)\s+(\d+)(?:\s*[-–]\s*(\d+))?\s*\]\s*/i;

/** Blocks are separated by a blank line, as in the admin's text. */
export function parseSessionTopics(text: string | null | undefined): SessionTopicsBlock[] {
  if (!text?.trim()) return [];
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const marker = block.match(TRACK_MARKER);
      if (!marker) return { text: block.trim(), trackRange: null };
      const start = parseInt(marker[1]!, 10);
      const end = marker[2] ? parseInt(marker[2], 10) : start;
      return { text: block.replace(TRACK_MARKER, '').trim(), trackRange: { start, end } };
    })
    .filter((block) => block.text.length > 0);
}

function pickLanguage(translations: Record<string, string> | undefined, language: string): string | null {
  const other = language === 'pt' ? 'en' : 'pt';
  const value = translations?.[language]?.trim() ? translations[language] : translations?.[other];
  return value?.trim() ? value.trim() : null;
}

export function getEventTopics(
  event: {
    main_topics_translations?: Record<string, string>;
    session_topics_translations?: Record<string, string>;
  },
  language: string,
): EventTopicsContent {
  const main = pickLanguage(event.main_topics_translations, language);
  const sessions = parseSessionTopics(pickLanguage(event.session_topics_translations, language));
  return { main, sessions, hasContent: !!main || sessions.length > 0 };
}

export function formatTrackRange({ start, end }: TrackRange): string {
  return start === end ? String(start) : `${start}–${end}`;
}

export function findTrackIndexByNumber(tracks: readonly { order: number }[], number: number): number {
  return tracks.findIndex((track) => track.order === number);
}
