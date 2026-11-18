import type { VideoMetadata } from 'expo-video';

/** The parts of an event (as the API maps it) that name a video on the lock screen. */
export interface NowPlayingEvent {
  teachers?: { name: string }[] | null;
  image?: { artworkUrl?: string | null } | null;
  sessions?: { tracks?: { speakerArtworkUrl?: string | null }[] | null }[] | null;
}

/** What the lock screen shows for a video besides its title. */
export interface EventNowPlayingInfo {
  /** The event's teachers, comma-separated; undefined when it lists none. */
  teacherNames?: string;
  /** Square artwork for the lock screen; null when the event has none. */
  artworkUrl: string | null;
}

/** The native players only load real URLs (a bundled asset in a release build is a resource name). */
function isLoadableUrl(url: string | null | undefined): url is string {
  return !!url && /^(https?|file):\/\//i.test(url);
}

/**
 * The teachers and artwork of an event for the lock screen, matching what the
 * audio player shows: the event's own square artwork, else the speaker artwork
 * the API puts on its tracks.
 */
export function eventNowPlayingInfo(
  event: NowPlayingEvent | null | undefined,
): EventNowPlayingInfo {
  const teacherNames =
    event?.teachers
      ?.map((teacher) => teacher.name)
      .filter(Boolean)
      .join(', ') || undefined;
  const trackArtwork = event?.sessions
    ?.flatMap((session) => session.tracks ?? [])
    .map((track) => track.speakerArtworkUrl)
    .find(isLoadableUrl);
  const artworkUrl = [event?.image?.artworkUrl, trackArtwork].find(isLoadableUrl) ?? null;
  return { teacherNames, artworkUrl };
}

/**
 * The metadata given to the video source, so the lock screen and Control
 * Center name the video instead of showing a blank card. Artwork is the first
 * loadable URL among the candidates (event artwork, video poster, bundled fallback).
 */
export function videoNowPlayingMetadata({
  title,
  artist,
  artworkCandidates,
}: {
  title: string;
  artist?: string;
  artworkCandidates: (string | null | undefined)[];
}): VideoMetadata {
  const metadata: VideoMetadata = { title };
  if (artist) metadata.artist = artist;
  const artwork = artworkCandidates.find(isLoadableUrl);
  if (artwork) metadata.artwork = artwork;
  return metadata;
}
