/**
 * Per-file transcript metadata sent by the API: the revision status and the
 * excerpts flag. Both only describe the file (they are shown as small tags);
 * the API never sends a transcript the reader may not see, so nothing here
 * hides anything.
 */

export const TRANSCRIPT_STATUSES = ['final', 'provisional', 'unrevised', 'draft'] as const;
export type TranscriptStatus = (typeof TRANSCRIPT_STATUSES)[number];

/** A tag shown next to a transcript's language: its status when not final, then excerpts. */
export type TranscriptTag = Exclude<TranscriptStatus, 'final'> | 'excerpts';

/** A cached payload from before the field existed (or an unknown value) counts as final. */
export function normalizeTranscriptStatus(raw: unknown): TranscriptStatus {
  return (TRANSCRIPT_STATUSES as readonly unknown[]).includes(raw) ? (raw as TranscriptStatus) : 'final';
}

export function transcriptTags(meta: { status?: unknown; isExcerpt?: boolean }): TranscriptTag[] {
  const tags: TranscriptTag[] = [];
  const status = normalizeTranscriptStatus(meta.status);
  if (status !== 'final') tags.push(status);
  if (meta.isExcerpt) tags.push('excerpts');
  return tags;
}

/**
 * The transcript to open for a reader: among the ones in the UI language, the
 * final one first (a provisional or draft text is a fallback); with none in that
 * language, the event's first transcript.
 */
export function pickTranscript<T extends { language?: string | null; status?: unknown }>(
  transcripts: T[],
  language: string,
): T | undefined {
  const inLanguage = transcripts.filter((tr) => tr.language === language);
  return (
    inLanguage.find((tr) => normalizeTranscriptStatus(tr.status) === 'final') ??
    inLanguage[0] ??
    transcripts[0]
  );
}
