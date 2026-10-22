/**
 * Which content tab the event page shows, and whether the inline audio
 * player belongs on it. Kept pure so the visibility rule is testable.
 */
export type EventContentTab = 'video' | 'tracks' | 'documents';

export interface EventContentAvailability {
  hasVideo: boolean;
  hasAudio: boolean;
  hasDocuments: boolean;
}

/**
 * The tab actually shown: the requested one when the event has that kind of
 * content, otherwise whichever kind exists (so an event with a single content
 * type never lands on an empty tab body).
 */
export function resolveContentTab(
  requested: EventContentTab,
  { hasVideo, hasAudio, hasDocuments }: EventContentAvailability,
): EventContentTab {
  if (requested === 'video' && hasVideo) return 'video';
  if (requested === 'tracks' && hasAudio) return 'tracks';
  if (requested === 'documents' && hasDocuments) return 'documents';
  return hasVideo ? 'video' : hasAudio ? 'tracks' : 'documents';
}

/**
 * The inline audio player (with its cached / paused track) only appears while
 * the Audio tab is showing and the loaded track belongs to this event. On the
 * Videos and Documents tabs it would cover the list below it.
 */
export function shouldShowInlinePlayer(opts: {
  ownsCurrentTrack: boolean;
  activeTab: EventContentTab;
}): boolean {
  return opts.ownsCurrentTrack && opts.activeTab === 'tracks';
}
