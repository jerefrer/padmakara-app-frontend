/**
 * Which content tab the event page shows, and whether the inline audio
 * player belongs on it. Kept pure so the visibility rule is testable.
 */
export type EventContentTab = 'video' | 'tracks' | 'documents' | 'topics';

export interface EventContentAvailability {
  hasVideo: boolean;
  hasAudio: boolean;
  hasDocuments: boolean;
  hasTopics?: boolean;
}

/**
 * The tab actually shown: the requested one when the event has that kind of
 * content, otherwise whichever kind exists (so an event with a single content
 * type never lands on an empty tab body).
 */
export function resolveContentTab(
  requested: EventContentTab,
  { hasVideo, hasAudio, hasDocuments, hasTopics }: EventContentAvailability,
): EventContentTab {
  if (requested === 'video' && hasVideo) return 'video';
  if (requested === 'tracks' && hasAudio) return 'tracks';
  if (requested === 'documents' && hasDocuments) return 'documents';
  if (requested === 'topics' && hasTopics) return 'topics';
  if (hasVideo) return 'video';
  if (hasAudio) return 'tracks';
  return !hasDocuments && hasTopics ? 'topics' : 'documents';
}

/**
 * The inline audio player (with its cached / paused track) only appears while
 * the Audio tab is showing and the loaded track belongs to this event. On the
 * Videos, Documents and Topics tabs it would cover the list below it.
 */
export function shouldShowInlinePlayer(opts: {
  ownsCurrentTrack: boolean;
  activeTab: EventContentTab;
}): boolean {
  return opts.ownsCurrentTrack && opts.activeTab === 'tracks';
}
