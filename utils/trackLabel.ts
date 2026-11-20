import type { Track } from '@/types';
import { getTrackTitle, type Language } from '@/utils/i18n';

/**
 * A track's title prefixed with its number in the event's track list, e.g.
 * "2 · Teaching". Many events have several tracks with the same title, so the
 * number is what tells them apart. A track without a number shows its title alone.
 */
export function getNumberedTrackTitle(track: Track, language: Language): string {
  const title = getTrackTitle(track, language);
  return track.order > 0 ? `${track.order} · ${title}` : title;
}
