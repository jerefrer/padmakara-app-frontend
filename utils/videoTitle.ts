import type { EventVideo } from '@/types';
import type { ContentLanguage } from '@/utils/i18n';

interface VideoTitleOptions {
  /** The user's content-language preference. 'pt' prefers the Portuguese
   *  title; 'en' and the bilingual 'en-pt' prefer English. */
  contentLanguage: ContentLanguage;
  t: (key: string, params?: Record<string, unknown>) => string;
  /** Total number of videos on the parent event. When there's more than
   *  one and neither title is set, a "Part N" suffix is appended to the
   *  date fallback so videos stay distinguishable in lists. */
  totalVideos?: number;
}

/** Format an ISO date ("YYYY-MM-DD") as "April 18th" — matches the date
 *  format used for session headers elsewhere in the app. */
function formatVideoDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  const day = d.getDate();
  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return `${month} ${ordinal(day)}`;
}

/**
 * Resolve the display title for an EventVideo, shared by VideoGrid (card
 * titles) and VideoPlayer (header title). Order of preference:
 *   1. The localized title (titlePt/titleEn, picked by content language).
 *   2. A formatted `videoDate`, with a "Part N" suffix when the event has
 *      more than one video.
 *   3. A generic "Video" fallback.
 */
export function getVideoTitle(video: EventVideo, opts: VideoTitleOptions): string {
  const { contentLanguage, t, totalVideos } = opts;
  const preferPt = contentLanguage === 'pt';
  const localized = preferPt
    ? video.titlePt?.trim() || video.titleEn?.trim()
    : video.titleEn?.trim() || video.titlePt?.trim();
  if (localized) return localized;

  const parts: string[] = [];
  if (video.videoDate) {
    const dateLabel = formatVideoDate(video.videoDate);
    if (dateLabel) parts.push(dateLabel);
  }
  if ((totalVideos ?? 0) > 1) {
    parts.push(t('video.part', { n: video.position + 1 }) || `Part ${video.position + 1}`);
  }
  return parts.join(' · ') || t('video.untitled') || 'Video';
}
