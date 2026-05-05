import cacheService from '@/services/cacheService';
import downloadService from '@/services/downloadService';
import retreatService from '@/services/retreatService';
import { Track, UserProgress } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Audio player phases — a deliberate three-state lifecycle:
 *
 *   'idle'    : no track loaded (initial state, after sign-out, before
 *               resume-last-played) — controls hidden or in idle preview.
 *   'loading' : a track is selected but the audio is still being resolved
 *               (download / cache / stream URL) and/or being seeked to the
 *               saved position. The slider already shows the *target*
 *               position so the UI doesn't flicker; play controls are
 *               disabled.
 *   'ready'   : audio is buffered and at the target position. All controls
 *               are interactive; the slider tracks live playback.
 *
 * That's the entire state machine. The previous implementation maintained
 * five overlapping states plus a dozen boolean flags and a session-id
 * pattern to coordinate cancellable async work; almost all of it existed
 * to paper over expo-av timing quirks that don't apply to expo-audio. The
 * `trackIdRef` below replaces the session-id mechanism with a single
 * source of truth for "which track are we currently working on".
 */
export type AudioPlayerState = 'idle' | 'loading' | 'ready';

const PRE_CACHE_DURATION_SECONDS = 3600;
const SAFETY_LOAD_TIMEOUT_MS = 15000;
const PROGRESS_SAVE_INTERVAL_S = 10;
const SKIP_INTERVAL_S = 15;
const PLAYBACK_SPEED_CYCLE = [1.0, 1.25, 1.5, 2.0, 0.75] as const;

export interface IdleTrackInfo {
  track: Track;
  meta: { retreatId: string; retreatName: string; groupName: string } | null;
  position: number;
  duration: number;
}

export interface AudioPlayerContextType {
  // State
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  playbackSpeed: number;
  isLoading: boolean;
  playerState: AudioPlayerState;
  trackList: Track[];
  currentTrackIndex: number;
  retreatId: string | null;
  retreatName: string | null;
  groupName: string | null;
  isPlayButtonDisabled: boolean;
  hasNextTrack: boolean;
  hasPreviousTrack: boolean;
  idleTrack: IdleTrackInfo | null;
  player: ReturnType<typeof useAudioPlayer> | null;

  // Actions
  playTrack: (track: Track, trackList: Track[], index: number, meta?: { retreatId: string; retreatName: string; groupName: string }) => void;
  resumeLastPlayed: () => void;
  clearTrack: () => void;
  togglePlayPause: () => void;
  seekTo: (positionMs: number) => void;
  skipForward: () => void;
  skipBackward: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  changePlaybackSpeed: () => void;
  setUpcomingTracks: (tracks: Track[]) => void;

  // Slider interaction
  onSlidingStart: () => void;
  onSlidingComplete: (value: number) => void;
  onSliderValueChange: (value: number) => void;

  // Callback registration
  setOnProgressUpdate: (cb: ((progress: UserProgress) => void) | undefined) => void;
  setOnTrackComplete: (cb: (() => void) | undefined) => void;
  setOnPlayingStateChange: (cb: ((isPlaying: boolean) => void) | undefined) => void;
  setOnNextTrack: (cb: (() => void) | undefined) => void;
  setOnPreviousTrack: (cb: (() => void) | undefined) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export function useAudioPlayerContext(): AudioPlayerContextType {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayerContext must be used within an AudioPlayerProvider');
  return ctx;
}

// ─── Helpers (pure / side-effect-free where possible) ──────────────────

async function readSavedPosition(trackId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(`progress_${trackId}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return typeof parsed.position === 'number' ? parsed.position : 0;
  } catch {
    return 0;
  }
}

async function resolveAudioSource(track: Track): Promise<string | null> {
  // Priority: explicitly downloaded → cached → freshly streamed (and
  // cached in the background for next time).
  try {
    const downloaded = await downloadService.getDownloadedTrackPath(track.id);
    if (downloaded) return downloaded;

    const cached = await cacheService.getCachedTrackPath(track.id);
    if (cached) return cached;

    const response = await retreatService.getTrackStreamUrl(track.id);
    if (!response.success || !response.url) {
      console.error(`Failed to get stream URL for ${track.title}: ${response.error}`);
      return null;
    }

    // Fire-and-forget background caching for offline next time.
    const retreatIdForCache = track.session_id || 'unknown';
    cacheService.cacheTrack(track.id, retreatIdForCache, response.url)
      .catch((err) => console.warn(`Background cache failed for ${track.title}:`, err));

    return response.url;
  } catch (error) {
    console.error('resolveAudioSource error:', error);
    return null;
  }
}

// ─── Provider ──────────────────────────────────────────────────────────

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  // ─── Track + metadata ───
  const [track, setTrack] = useState<Track | null>(null);
  const [trackListState, setTrackListState] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [metaRetreatId, setMetaRetreatId] = useState<string | null>(null);
  const [metaRetreatName, setMetaRetreatName] = useState<string | null>(null);
  const [metaGroupName, setMetaGroupName] = useState<string | null>(null);
  const [upcomingTracks, setUpcomingTracks] = useState<Track[]>([]);
  const [idleTrack, setIdleTrack] = useState<IdleTrackInfo | null>(null);

  // ─── Audio engine ───
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [phase, setPhase] = useState<AudioPlayerState>('idle');
  const [targetPosition, setTargetPosition] = useState(0);
  const [userScrubValue, setUserScrubValue] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  // Optimistic play state: when the user taps play during the loading
  // phase (or before audio is ready), we acknowledge the intent
  // immediately by flipping isPlaying to true in the UI, and trigger
  // the actual player.play() as soon as phase becomes 'ready'.
  const [pendingPlay, setPendingPlay] = useState(false);

  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);

  // ─── Refs (don't trigger renders) ───
  // The id of the track we're currently working on. Captured by async
  // operations so they can bail out if the user has moved on.
  const trackIdRef = useRef<string | null>(null);
  // Guards the "audio loaded → seek to target" transition so it only runs
  // once per track load.
  const seekToTargetDoneRef = useRef<string | null>(null);
  // Guards against the completion callback firing more than once per track.
  const hasCompletedRef = useRef(false);
  // Throttles the every-10s progress save.
  const lastSavedSecondRef = useRef(-1);
  // In-memory cache of saved positions per track id. Lets the track-change
  // effect place the slider at the right point synchronously, without
  // waiting for an AsyncStorage round-trip — eliminates the brief slider
  // jump from the old track's position to the new one.
  const savedPositionsRef = useRef<Map<string, number>>(new Map());

  // ─── Callback refs (registered by consumer screens) ───
  const onProgressUpdateRef = useRef<((progress: UserProgress) => void) | undefined>(undefined);
  const onTrackCompleteRef = useRef<(() => void) | undefined>(undefined);
  const onPlayingStateChangeRef = useRef<((isPlaying: boolean) => void) | undefined>(undefined);
  const onNextTrackRef = useRef<(() => void) | undefined>(undefined);
  const onPreviousTrackRef = useRef<(() => void) | undefined>(undefined);
  const [hasNextTrack, setHasNextTrack] = useState(false);
  const [hasPreviousTrack, setHasPreviousTrack] = useState(false);

  // ─── Derived values ───
  // isPlaying reflects optimistic intent: if the user tapped play before
  // audio was ready, the UI shows the pause icon and the playing-bars
  // animation right away, even though the underlying engine is still
  // buffering.
  const isPlaying = !!status?.playing || (phase !== 'ready' && pendingPlay);
  // While loading, ignore status?.duration — the player object can briefly
  // carry over the previous track's duration during the source switch,
  // which would show e.g. "3:36 remaining" on a 130-minute track until
  // playback actually started. Use the metadata duration the listing
  // already gave us.
  const duration = phase === 'ready'
    ? (status?.duration || track?.duration || 0)
    : (track?.duration || 0);

  // Position display priority:
  //   1. While the user is dragging the slider, show their value
  //   2. While loading, show the target (saved or seek-to) position so the
  //      slider appears at the right place from the very first frame
  //   3. While ready, follow live playback
  const livePosition = status?.currentTime ?? 0;
  const position = userScrubValue !== null
    ? userScrubValue
    : phase === 'ready'
      ? livePosition
      : targetPosition;

  const isLoading = phase === 'loading';
  // Optimistic play UX: the play button is interactive whenever there is
  // any track to play (loaded or idle). A loading state no longer locks
  // it — the tap is queued and fires as soon as the audio is ready.
  // Skip ±15s and speed change still need a ready engine to act on; the
  // mobile/desktop player bars gate those separately.
  const isPlayButtonDisabled = !track && !idleTrack;

  // ─── Audio session (mount once) ───
  useEffect(() => {
    setAudioModeAsync({
      allowsRecording: false,
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      interruptionModeAndroid: 'duckOthers',
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  // ─── Pre-load all saved positions into memory on mount ───
  // Lets the track-change effect place the slider at the right point
  // synchronously when the user taps a track, without waiting for an
  // AsyncStorage read.
  useEffect(() => {
    (async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const progressKeys = keys.filter((k) => k.startsWith('progress_'));
        if (progressKeys.length === 0) return;
        const items = await AsyncStorage.multiGet(progressKeys);
        const map = new Map<string, number>();
        for (const [k, v] of items) {
          if (!v) continue;
          try {
            const parsed = JSON.parse(v);
            if (typeof parsed.position === 'number') {
              map.set(k.slice('progress_'.length), parsed.position);
            }
          } catch {}
        }
        savedPositionsRef.current = map;
      } catch (error) {
        console.error('Pre-load saved positions failed:', error);
      }
    })();
  }, []);

  // ─── Restore idle track (display-only) on mount ───
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('last_played_track');
        if (!saved) return;
        const { track: savedTrack, meta } = JSON.parse(saved) as {
          track: Track;
          meta: { retreatId: string; retreatName: string; groupName: string } | null;
        };
        if (!savedTrack?.id) return;
        const position = await readSavedPosition(savedTrack.id);
        setIdleTrack({
          track: savedTrack,
          meta,
          position,
          duration: savedTrack.duration || 0,
        });
      } catch (error) {
        console.error('restoreIdleTrack error:', error);
      }
    })();
  }, []);

  // ─── Stop playback when the user signs out ───
  const { isAuthenticated } = useAuth();
  const wasAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticatedRef.current && !isAuthenticated) {
      try { player?.pause(); } catch {}
      setTrack(null);
      setAudioSource(null);
      setPhase('idle');
      setTargetPosition(0);
    }
    wasAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated, player]);

  // ─── Lock screen / Now Playing controls (iOS + Android) ───
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!player || typeof player.setActiveForLockScreen !== 'function') return;

    if (track) {
      try {
        const metadata: Record<string, string> = { title: track.title };
        if (track.speakerName) metadata.artist = track.speakerName;
        if (metaRetreatName) metadata.albumTitle = metaRetreatName;
        player.setActiveForLockScreen(true, metadata, {
          showSeekForward: true,
          showSeekBackward: true,
        });
      } catch (error) {
        console.warn('setActiveForLockScreen failed:', error);
      }
    } else {
      try { player.setActiveForLockScreen(false); } catch {}
    }
  }, [track, player, metaRetreatName]);

  // ─── Track change → load source + saved position ───
  useEffect(() => {
    if (!track) {
      // No track selected: drop everything back to idle.
      trackIdRef.current = null;
      seekToTargetDoneRef.current = null;
      setAudioSource(null);
      setPhase('idle');
      setTargetPosition(0);
      setUserScrubValue(null);
      lastSavedSecondRef.current = -1;
      hasCompletedRef.current = false;
      return;
    }

    const currentId = track.id;
    trackIdRef.current = currentId;
    seekToTargetDoneRef.current = null;
    setUserScrubValue(null);
    lastSavedSecondRef.current = -1;
    hasCompletedRef.current = false;
    setPendingPlay(false);

    // Stop any audio that may already be playing from a previous track —
    // we don't want overlap during the brief moment the new source is
    // resolving.
    try { player?.pause(); } catch {}

    setPhase('loading');
    // Invalidate the previous source so the player is re-created from
    // scratch. Without this, useAudioPlayer keeps reporting status.isLoaded
    // for the *previous* track's audio while we're resolving the new one,
    // and the seek-to-target effect can fire with a stale targetPosition
    // before the saved position has been read from storage.
    setAudioSource(null);
    // Place the slider at the right position immediately, using the
    // in-memory cache. Falls back to 0 for tracks we've never played.
    // The async readSavedPosition below still runs as a corrective in
    // case the cache misses.
    setTargetPosition(savedPositionsRef.current.get(currentId) ?? 0);

    // Safety net: if source resolution or audio buffering is still
    // unresolved after 15s, transition to ready anyway and surface the
    // problem in the logs so the user isn't stuck staring at a spinner.
    const safetyTimer = setTimeout(() => {
      if (trackIdRef.current === currentId && phase === 'loading') {
        console.warn(`[SAFETY] Track load exceeded ${SAFETY_LOAD_TIMEOUT_MS}ms: ${track.title}`);
        setPhase('ready');
      }
    }, SAFETY_LOAD_TIMEOUT_MS);

    (async () => {
      // Read saved position FIRST so the slider can be positioned correctly
      // before the audio source is even resolved. This eliminates the
      // "slider jumps from 0 to saved position" flicker.
      const saved = await readSavedPosition(currentId);
      if (trackIdRef.current !== currentId) return;
      setTargetPosition(saved);

      const source = await resolveAudioSource(track);
      if (trackIdRef.current !== currentId) return;
      if (!source) {
        console.error(`Could not resolve audio source for ${track.title}`);
        // Stay in loading; safety timer will eventually unstick the UI.
        return;
      }
      setAudioSource(source);
    })();

    return () => clearTimeout(safetyTimer);
    // We deliberately key only on `track` so this effect runs once per
    // track switch; phase/player intentionally don't re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  // ─── Audio loaded → seek to target → ready ───
  // Single transition. No artificial delays. Runs at most once per track
  // load, gated by seekToTargetDoneRef. The audioSource check prevents the
  // effect from firing against the placeholder player that useAudioPlayer
  // returns while we're still resolving the new source — that placeholder
  // can report status.isLoaded=true even though no real audio is loaded.
  useEffect(() => {
    if (phase !== 'loading') return;
    if (!track || !audioSource || !status?.isLoaded || !player) return;
    if (seekToTargetDoneRef.current === track.id) return;

    const currentId = track.id;
    seekToTargetDoneRef.current = currentId;

    (async () => {
      try {
        // Always align the audio engine with targetPosition, even when
        // targetPosition is 0. expo-audio sometimes carries a stale
        // currentTime across source changes; without an explicit seek
        // the slider would show the previous track's position until the
        // user triggered playback.
        const needSeek = Math.abs((status.currentTime ?? 0) - targetPosition) > 0.5;
        if (needSeek) {
          await player.seekTo(targetPosition);
        }
        // Restore the previous playback rate (expo-audio resets it on
        // source change).
        try { player.setPlaybackRate(playbackSpeed, 'high'); } catch {}
      } catch (error) {
        console.error('Seek to target failed:', error);
      }
      if (trackIdRef.current !== currentId) return;
      setPhase('ready');
    })();
  }, [phase, track, audioSource, status?.isLoaded, player, targetPosition, playbackSpeed]);

  // ─── Fire any queued play when audio becomes ready ───
  // Optimistic play: if the user tapped play during loading (or while idle),
  // pendingPlay is true; the moment phase flips to 'ready', start playback.
  useEffect(() => {
    if (phase !== 'ready' || !pendingPlay || !player) return;
    setPendingPlay(false);
    try { player.play(); } catch (error) {
      console.error('pendingPlay play() failed:', error);
    }
  }, [phase, pendingPlay, player]);

  // ─── Progress save + completion detection during playback ───
  useEffect(() => {
    if (phase !== 'ready' || !track || !status) return;
    if (!status.playing) return;

    const currentSeconds = Math.floor(status.currentTime ?? 0);

    if (currentSeconds > 0
      && currentSeconds % PROGRESS_SAVE_INTERVAL_S === 0
      && currentSeconds !== lastSavedSecondRef.current) {
      lastSavedSecondRef.current = currentSeconds;
      void saveProgress(currentSeconds * 1000);
    }

    if (!hasCompletedRef.current
      && (status.didJustFinish
        || (status.duration > 0 && status.currentTime >= status.duration))) {
      hasCompletedRef.current = true;
      void saveProgress(status.duration * 1000);
      onTrackCompleteRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, phase, track]);

  // ─── Pre-cache upcoming tracks once we're 30s into playback ───
  const hasPreCachedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== 'ready' || !track || !status?.playing) return;
    if (!upcomingTracks.length) return;
    if (hasPreCachedForRef.current === track.id) return;
    if ((status.currentTime ?? 0) < 30) return;

    hasPreCachedForRef.current = track.id;

    const getStreamUrlForTrack = async (trackId: string): Promise<string | null> => {
      try {
        if (await cacheService.getCachedTrackPath(trackId)) return null;
        if (await downloadService.getDownloadedTrackPath(trackId)) return null;
        const response = await retreatService.getTrackStreamUrl(trackId);
        return response.success ? response.url || null : null;
      } catch {
        return null;
      }
    };

    cacheService.preCacheTracksForDuration(
      upcomingTracks.map((t) => ({ id: t.id, duration: t.duration })),
      metaRetreatId || track.session_id || 'unknown',
      getStreamUrlForTrack,
      PRE_CACHE_DURATION_SECONDS,
    ).catch((err) => console.warn('[PRE-CACHE] failed:', err));
  }, [phase, track, status?.playing, status?.currentTime, upcomingTracks, metaRetreatId]);

  // ─── Notify external listeners when isPlaying flips ───
  useEffect(() => {
    onPlayingStateChangeRef.current?.(isPlaying);
  }, [isPlaying]);

  // ─── Save progress to AsyncStorage + notify consumer ───
  const saveProgress = useCallback(async (positionMs: number) => {
    if (!track) return;
    try {
      const trackDuration = status?.duration || track.duration || 0;
      const positionSeconds = Math.floor(positionMs / 1000);
      const progress: UserProgress = {
        trackId: track.id,
        position: positionSeconds,
        completed: trackDuration > 0 && positionMs / 1000 >= trackDuration - 1,
        lastPlayed: new Date().toISOString(),
        bookmarks: [],
      };
      // Keep the in-memory cache fresh so the next track switch can use it
      // synchronously.
      savedPositionsRef.current.set(track.id, positionSeconds);
      await AsyncStorage.setItem(`progress_${track.id}`, JSON.stringify(progress));
      onProgressUpdateRef.current?.(progress);
    } catch (error) {
      console.error('saveProgress error:', error);
    }
  }, [track, status?.duration]);

  // ─── Persist last-played for "resume on next launch" ───
  const saveLastPlayedTrack = useCallback(async (
    savedTrack: Track,
    meta?: { retreatId: string; retreatName: string; groupName: string },
  ) => {
    try {
      await AsyncStorage.setItem(
        'last_played_track',
        JSON.stringify({ track: savedTrack, meta: meta || null }),
      );
    } catch (error) {
      console.error('saveLastPlayedTrack error:', error);
    }
  }, []);

  // ─── Actions ───

  const playTrack = useCallback((
    newTrack: Track,
    newTrackList: Track[],
    index: number,
    meta?: { retreatId: string; retreatName: string; groupName: string },
  ) => {
    setIdleTrack(null);
    setTrackListState(newTrackList);
    setCurrentTrackIndex(index);
    if (meta) {
      setMetaRetreatId(meta.retreatId);
      setMetaRetreatName(meta.retreatName);
      setMetaGroupName(meta.groupName);
    }
    // Re-tapping the currently-loaded track is a no-op — the user can use
    // play/pause to control playback. The session screen calls playTrack
    // both on mount (auto-load) and on user tap; treating same-track taps
    // as track switches would reset position and cancel playback.
    if (track?.id !== newTrack.id) {
      setTrack(newTrack);
    }
    void saveLastPlayedTrack(newTrack, meta);
  }, [track, saveLastPlayedTrack]);

  const resumeLastPlayed = useCallback(() => {
    if (!idleTrack) return;
    setPendingPlay(true);
    const { track: idleT, meta } = idleTrack;
    playTrack(idleT, [idleT], 0, meta || undefined);
  }, [idleTrack, playTrack]);

  const clearTrack = useCallback(() => {
    try { player?.pause(); } catch {}
    setTrack(null);
    setTrackListState([]);
    setCurrentTrackIndex(0);
    setMetaRetreatId(null);
    setMetaRetreatName(null);
    setMetaGroupName(null);
    setIdleTrack(null);
  }, [player]);

  const togglePlayPause = useCallback(() => {
    // Idle: there's a saved last-played track but no audio loaded. Mark
    // play as pending and resume the track; once it loads, playback will
    // start automatically.
    if (phase === 'idle' && idleTrack) {
      setPendingPlay(true);
      const { track: idleT, meta } = idleTrack;
      playTrack(idleT, [idleT], 0, meta || undefined);
      return;
    }
    // Loading: the audio engine isn't ready yet. Toggle the optimistic
    // pending flag — UI updates immediately, real play() is fired by the
    // phase→ready effect.
    if (phase === 'loading') {
      setPendingPlay((p) => !p);
      return;
    }
    // Ready: drive the engine directly.
    if (phase === 'ready' && player) {
      try {
        if (status?.playing) player.pause();
        else player.play();
      } catch (error) {
        console.error('togglePlayPause error:', error);
      }
      setPendingPlay(false);
    }
  }, [phase, player, status?.playing, idleTrack, playTrack]);

  const seekTo = useCallback((positionMs: number) => {
    if (phase !== 'ready' || !player) return;
    const positionSeconds = Math.max(0, positionMs / 1000);
    try {
      player.seekTo(positionSeconds);
      void saveProgress(positionSeconds * 1000);
    } catch (error) {
      console.error('seekTo error:', error);
    }
  }, [phase, player, saveProgress]);

  const skipForward = useCallback(() => {
    if (phase !== 'ready' || !player) return;
    const max = duration || 0;
    const next = Math.min(max, (status?.currentTime ?? 0) + SKIP_INTERVAL_S);
    seekTo(next * 1000);
  }, [phase, player, duration, status?.currentTime, seekTo]);

  const skipBackward = useCallback(() => {
    if (phase !== 'ready' || !player) return;
    const next = Math.max(0, (status?.currentTime ?? 0) - SKIP_INTERVAL_S);
    seekTo(next * 1000);
  }, [phase, player, status?.currentTime, seekTo]);

  const changePlaybackSpeed = useCallback(() => {
    if (phase !== 'ready' || !player) return;
    const i = PLAYBACK_SPEED_CYCLE.indexOf(playbackSpeed as typeof PLAYBACK_SPEED_CYCLE[number]);
    const next = PLAYBACK_SPEED_CYCLE[(i + 1) % PLAYBACK_SPEED_CYCLE.length];
    setPlaybackSpeed(next);
    try { player.setPlaybackRate(next, 'high'); } catch (error) {
      console.error('changePlaybackSpeed error:', error);
    }
  }, [phase, player, playbackSpeed]);

  // ─── Slider interaction ───
  // The slider is a controlled input: while the user drags, we mirror their
  // value into userScrubValue so the thumb visibly tracks their finger
  // without being yanked back by status.currentTime updates.
  const onSlidingStart = useCallback(() => {
    setUserScrubValue(position);
  }, [position]);

  const onSliderValueChange = useCallback((value: number) => {
    setUserScrubValue(value);
  }, []);

  const onSlidingComplete = useCallback((value: number) => {
    setUserScrubValue(null);
    seekTo(value * 1000);
  }, [seekTo]);

  // ─── Next / previous (delegated to consumer via callback) ───
  const nextTrackAction = useCallback(() => {
    onNextTrackRef.current?.();
  }, []);
  const previousTrackAction = useCallback(() => {
    onPreviousTrackRef.current?.();
  }, []);

  // ─── Callback registration ───
  const setOnProgressUpdate = useCallback((cb: ((progress: UserProgress) => void) | undefined) => {
    onProgressUpdateRef.current = cb;
  }, []);
  const setOnTrackComplete = useCallback((cb: (() => void) | undefined) => {
    onTrackCompleteRef.current = cb;
  }, []);
  const setOnPlayingStateChange = useCallback((cb: ((isPlaying: boolean) => void) | undefined) => {
    onPlayingStateChangeRef.current = cb;
  }, []);
  const setOnNextTrack = useCallback((cb: (() => void) | undefined) => {
    onNextTrackRef.current = cb;
    setHasNextTrack(!!cb);
  }, []);
  const setOnPreviousTrack = useCallback((cb: (() => void) | undefined) => {
    onPreviousTrackRef.current = cb;
    setHasPreviousTrack(!!cb);
  }, []);

  const value = useMemo<AudioPlayerContextType>(() => ({
    currentTrack: track,
    isPlaying,
    position,
    duration,
    playbackSpeed,
    isLoading,
    playerState: phase,
    trackList: trackListState,
    currentTrackIndex,
    retreatId: metaRetreatId,
    retreatName: metaRetreatName,
    groupName: metaGroupName,
    isPlayButtonDisabled,
    hasNextTrack,
    hasPreviousTrack,
    idleTrack,
    player: track ? player : null,

    playTrack,
    resumeLastPlayed,
    clearTrack,
    togglePlayPause,
    seekTo,
    skipForward,
    skipBackward,
    nextTrack: nextTrackAction,
    previousTrack: previousTrackAction,
    changePlaybackSpeed,
    setUpcomingTracks,

    onSlidingStart,
    onSlidingComplete,
    onSliderValueChange,

    setOnProgressUpdate,
    setOnTrackComplete,
    setOnPlayingStateChange,
    setOnNextTrack,
    setOnPreviousTrack,
  }), [
    track, isPlaying, position, duration, playbackSpeed, isLoading, phase,
    trackListState, currentTrackIndex, metaRetreatId, metaRetreatName, metaGroupName,
    isPlayButtonDisabled, hasNextTrack, hasPreviousTrack, idleTrack, player,
    playTrack, resumeLastPlayed, clearTrack, togglePlayPause, seekTo,
    skipForward, skipBackward, nextTrackAction, previousTrackAction,
    changePlaybackSpeed,
    onSlidingStart, onSlidingComplete, onSliderValueChange,
    setOnProgressUpdate, setOnTrackComplete, setOnPlayingStateChange,
    setOnNextTrack, setOnPreviousTrack,
  ]);

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}
