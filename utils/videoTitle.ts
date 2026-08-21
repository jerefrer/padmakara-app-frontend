import type { EventVideo } from '@/types';
import type { ContentLanguage, Language } from '@/utils/i18n';
import { formatMonthDay } from '@/utils/dateFormat';

interface VideoTitleOptions {
  /** The user's content-language preference. 'pt' prefers the Portuguese
   *  title; 'en' and the bilingual 'en-pt' prefer English. */
  contentLanguage: ContentLanguage;
  /** The UI language, used for the date fallback. Distinct from
   *  contentLanguage: the date is app chrome, not teaching content. */
  language: Language;
  t: (key: string, params?: Record<string, unknown>) => string;
  /** Total number of videos on the parent event. When there's more than
   *  one and neither title is set, a "Part N" suffix is appended to the
   *  date fallback so videos stay distinguishable in lists. */
  totalVideos?: number;
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
  const { contentLanguage, language, t, totalVideos } = opts;
  const preferPt = contentLanguage === 'pt';
  const localized = preferPt
    ? video.titlePt?.trim() || video.titleEn?.trim()
    : video.titleEn?.trim() || video.titlePt?.trim();
  if (localized) return localized;

  const parts: string[] = [];
  if (video.videoDate) {
    const dateLabel = formatMonthDay(new Date(video.videoDate), language);
    if (dateLabel) parts.push(dateLabel);
  }
  if ((totalVideos ?? 0) > 1) {
    parts.push(t('video.part', { n: video.position + 1 }) || `Part ${video.position + 1}`);
  }
  return parts.join(' · ') || t('video.untitled') || 'Video';
}
