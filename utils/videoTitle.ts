import type { EventVideo } from '@/types';
import type { Language } from '@/utils/i18n';
import { formatMonthDay } from '@/utils/dateFormat';

interface VideoTitleOptions {
  /** The interface language. A video title and its date fallback are app
   *  chrome, so both follow the UI language rather than the audio-track
   *  preference, which is about which recordings to list. */
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
  const { language, t, totalVideos } = opts;
  const preferPt = language === 'pt';
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
