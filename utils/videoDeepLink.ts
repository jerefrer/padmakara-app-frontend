/** Pure helpers for opening an event straight on a video position (Bookmarks tab). */

export function resolveVideoDeepLink<V extends { id: number }>(
  videos: V[] | undefined,
  params: { videoId?: string; position?: string },
): { video: V; position: number | undefined } | null {
  if (!params.videoId || !videos) return null;
  const id = Number(params.videoId);
  const video = videos.find((v) => v.id === id);
  if (!video) return null;
  // No usable position (a whole-video bookmark) means "resume where the user
  // left off", which the caller expresses as `undefined`.
  const parsed = params.position === undefined || params.position === '' ? NaN : Number(params.position);
  const position = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
  return { video, position };
}

/**
 * Where playback starts: the deep-link position when there is one (and it
 * lies inside the video), otherwise the saved resume position.
 */
export function pickResumePosition(
  initial: number | undefined,
  computed: number,
  durationSeconds: number,
): number {
  if (initial === undefined || initial < 0) return computed;
  if (durationSeconds > 0 && initial >= durationSeconds) return computed;
  return Math.floor(initial);
}
