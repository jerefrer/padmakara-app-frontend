import cacheService from '@/services/cacheService';
import downloadService from '@/services/downloadService';
import retreatService from '@/services/retreatService';
import { Track, UserProgress } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Audio player state machine
export type AudioPlayerState = 'LOADING' | 'READY' | 'RESTORED' | 'PLAYING' | 'SEEKING';

// Pre-cache lookahead duration: 1 hour (3600 seconds)
const PRE_CACHE_DURATION_SECONDS = 3600;

export interface AudioPlayerContextType {
  // State
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;      // displayPosition in seconds
  duration: number;      // in seconds
  playbackSpeed: number;
  isLoading: boolean;    // isTrackLoading
  playerState: AudioPlayerState;
  trackList: Track[];
  currentTrackIndex: number;
  retreatId: string | null;
  retreatName: string | null;
  groupName: string | null;
  isPlayButtonDisabled: boolean;
  hasNextTrack: boolean;
  hasPreviousTrack: boolean;

  // Actions
  playTrack: (track: Track, trackList: Track[], index: number, meta?: { retreatId: string; retreatName: string; groupName: string }) => void;
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

  // Callback registration for retreat screen
  setOnProgressUpdate: (cb: ((progress: UserProgress) => void) | undefined) => void;
  setOnTrackComplete: (cb: (() => void) | undefined) => void;
  setOnPlayingStateChange: (cb: ((isPlaying: boolean) => void) | undefined) => void;
  setOnNextTrack: (cb: (() => void) | undefined) => void;
  setOnPreviousTrack: (cb: (() => void) | undefined) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export function useAudioPlayerContext(): AudioPlayerContextType {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayerContext must be used within an AudioPlayerProvider');
  }
  return context;
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  // --- Track & metadata state ---
  const [track, setTrack] = useState<Track | null>(null);
  const [trackListState, setTrackListState] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [metaRetreatId, setMetaRetreatId] = useState<string | null>(null);
  const [metaRetreatName, setMetaRetreatName] = useState<string | null>(null);
  const [metaGroupName, setMetaGroupName] = useState<string | null>(null);

  // --- Callback refs (registered by consuming screens) ---
  const onProgressUpdateRef = useRef<((progress: UserProgress) => void) | undefined>(undefined);
  const onTrackCompleteRef = useRef<(() => void) | undefined>(undefined);
  const onPlayingStateChangeRef = useRef<((isPlaying: boolean) => void) | undefined>(undefined);
  const onNextTrackRef = useRef<(() => void) | undefined>(undefined);
  const onPreviousTrackRef = useRef<(() => void) | undefined>(undefined);
  const [hasNextTrack, setHasNextTrack] = useState(false);
  const [hasPreviousTrack, setHasPreviousTrack] = useState(false);

  // --- Upcoming tracks for pre-caching ---
  const [upcomingTracks, setUpcomingTracks] = useState<Track[]>([]);

  // --- State machine and core state ---
  const [playerState, setPlayerState] = useState<AudioPlayerState>('LOADING');
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [loadedTrackId, setLoadedTrackId] = useState<string | null>(null);

  // Position state
  const [playerPosition, setPlayerPosition] = useState(0);
  const [displayPosition, setDisplayPosition] = useState(0);
  const [restorationProtection, setRestorationProtection] = useState(false);
  const [expectedPosition, setExpectedPosition] = useState(0);
  const [isSeekInProgress, setIsSeekInProgress] = useState(false);
  const [pendingTimeouts, setPendingTimeouts] = useState<ReturnType<typeof setTimeout>[]>([]);
  const [isRestorationInProgress, setIsRestorationInProgress] = useState(false);
  const [restorationTrackId, setRestorationTrackId] = useState<string | null>(null);
  const currentRestorationSessionIdRef = useRef<string | null>(null);
  const [isStreamLoading, setIsStreamLoading] = useState(false);
  const [streamLoadedTrackId, setStreamLoadedTrackId] = useState<string | null>(null);
  const [isTrackLoading, setIsTrackLoading] = useState(false);

  // Pre-caching state
  const hasPreCachedForTrackRef = useRef<string | null>(null);

  // --- expo-audio hooks ---
  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);

  // --- Derived values ---
  const duration = status?.duration || track?.duration || 0;
  const isPlaying = status?.playing || false;
  const isLoading = playerState === 'LOADING';
  const isPlayButtonDisabled = isLoading || isSeekInProgress;

  // --- Helper: safe session ID clearing ---
  const safeClearSessionId = (reason: string, force: boolean = false) => {
    console.log(`[SESSION] Attempting to clear session ID: reason="${reason}", force=${force}, isRestorationInProgress=${isRestorationInProgress}, currentSessionId=${currentRestorationSessionIdRef.current}`);

    if (!force && isRestorationInProgress) {
      console.log(`[SESSION] Blocked session ID clearing during active restoration: reason="${reason}"`);
      return false;
    }

    console.log(`[SESSION] Clearing session ID: ${currentRestorationSessionIdRef.current} -> null (reason: ${reason})`);
    currentRestorationSessionIdRef.current = null;
    return true;
  };

  // --- Helper: get remembered position ---
  const getRememberedPosition = async (trackId: string): Promise<{ position: number; duration: number }> => {
    try {
      const progressKey = `progress_${trackId}`;
      const savedProgress = await AsyncStorage.getItem(progressKey);

      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        return {
          position: progress.position || 0,
          duration: track?.duration || 1800,
        };
      }
    } catch (error) {
      console.error('Error getting remembered position:', error);
    }

    return { position: 0, duration: track?.duration || 1800 };
  };

  // --- Setup audio session on mount ---
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

  // --- Load new track effect ---
  useEffect(() => {
    // Cancel all pending timeouts when switching tracks
    pendingTimeouts.forEach(timeout => clearTimeout(timeout));
    setPendingTimeouts([]);

    if (track) {
      console.log(`Loading new track: ${track.title} (${track.id})`);

      // Skip if same track already loaded and being restored
      if (loadedTrackId === track.id && isRestorationInProgress && restorationTrackId === track.id) {
        console.log(`Skipping track loading - same track already loaded and being restored: ${track.id}`);
        return;
      }

      // Cancel any ongoing restoration for track switch
      if (isRestorationInProgress) {
        console.log('Cancelling ongoing restoration for track switch');
        setRestorationTrackId(null);
        safeClearSessionId("track switch cancellation", true);
      }

      // Start loading state immediately
      setIsTrackLoading(true);

      // Set optimistic display with remembered position
      const setupOptimisticDisplay = async () => {
        const remembered = await getRememberedPosition(track.id);
        console.log(`Setting optimistic display: position=${remembered.position}s, duration=${remembered.duration}s`);

        setDisplayPosition(remembered.position);
        setPlayerPosition(remembered.position);
        setExpectedPosition(remembered.position);

        setPlayerState('LOADING');
        setLoadedTrackId(null);
        setRestorationProtection(false);
        setIsSeekInProgress(false);
        setIsRestorationInProgress(false);
        setRestorationTrackId(null);
        setIsStreamLoading(false);
        setStreamLoadedTrackId(null);
        hasPreCachedForTrackRef.current = null;
        safeClearSessionId("track loading reset", false);

        loadTrack(track);
      };

      setupOptimisticDisplay();

      // Safety timeout: if loading gets stuck, clear the spinner after 15s
      const safetyTimeout = setTimeout(() => {
        setIsTrackLoading(prev => {
          if (prev) {
            console.warn(`[SAFETY] Clearing stuck loading state after 15s for track: ${track.title}`);
          }
          return false;
        });
      }, 15000);
      setPendingTimeouts(prev => [...prev, safetyTimeout]);
    } else {
      console.log('No track selected, resetting');
      setAudioSource(null);
      setPlayerState('LOADING');
      setLoadedTrackId(null);
      setPlayerPosition(0);
      setDisplayPosition(0);
      setExpectedPosition(0);
      setRestorationProtection(false);
      setIsSeekInProgress(false);
      setIsRestorationInProgress(false);
      setRestorationTrackId(null);
      setIsStreamLoading(false);
      setStreamLoadedTrackId(null);
      setIsTrackLoading(false);
      safeClearSessionId("no track reset", false);
    }
  }, [track]);

  // --- Handle audio loading and restoration ---
  useEffect(() => {
    if (!status || !track) return;

    // Prevent effect from running during active restoration
    if (isRestorationInProgress) {
      return;
    }

    // State machine transitions - prevent duplicate loading for same track
    // Note: Don't require status.duration > 0 — streaming URLs may report 0 duration until fully buffered
    if (playerState === 'LOADING' && status.isLoaded && loadedTrackId !== track.id) {
      console.log(`Audio loaded: ${track.title} (${track.id}) - Duration: ${status.duration}s (track.duration: ${track.duration}s)`);
      setLoadedTrackId(track.id);

      const isFirstLoad = loadedTrackId === null;
      const delay = isFirstLoad ? 100 : 800;

      const timeout = setTimeout(() => {
        console.log(`Audio stabilized - transitioning to READY (delay: ${delay}ms)`);
        setPlayerState('READY');
        setIsTrackLoading(false);
      }, delay);

      setPendingTimeouts(prev => [...prev, timeout]);
    }

    // Automatic restoration when ready
    const isAudioSourceReady = streamLoadedTrackId === track.id;

    if (playerState === 'READY' && loadedTrackId === track.id && !isRestorationInProgress && isAudioSourceReady) {
      console.log(`Auto-restoring position for: ${track.title}`);
      restoreSavedPosition();
    }
  }, [status, track, playerState, loadedTrackId, isRestorationInProgress, audioSource, isStreamLoading, streamLoadedTrackId]);

  // --- Handle position updates during normal playback ---
  useEffect(() => {
    if (!status || !track) return;

    if (playerState !== 'PLAYING' && playerState !== 'SEEKING') return;
    if (loadedTrackId !== track.id || status.currentTime === undefined) return;

    // State-based protection
    if (restorationProtection) {
      const positionDiff = Math.abs(status.currentTime - expectedPosition);
      const tolerance = playerState === 'PLAYING' ? 3 : 2;

      if (positionDiff <= tolerance) {
        setRestorationProtection(false);
        setIsSeekInProgress(false);
      } else {
        return;
      }
    }

    // Update positions only if not currently seeking via slider
    if (playerState !== 'SEEKING') {
      setPlayerPosition(status.currentTime);
      setDisplayPosition(status.currentTime);
    }

    // Save progress every 10 seconds (only during normal playback)
    if (playerState === 'PLAYING') {
      const currentSeconds = Math.floor(status.currentTime);
      if (currentSeconds > 0 && currentSeconds % 10 === 0) {
        saveProgress(status.currentTime * 1000);
      }
    }

    // Check for completion
    if (status.didJustFinish || (status.currentTime >= status.duration && status.duration > 0)) {
      console.log('Track completed');
      saveProgress(status.duration * 1000);
      onTrackCompleteRef.current?.();
    }
  }, [status, track, playerState, loadedTrackId, restorationProtection, expectedPosition]);

  // --- Pre-caching effect ---
  useEffect(() => {
    if (!track || !status || !upcomingTracks || upcomingTracks.length === 0) return;
    if (playerState !== 'PLAYING' || !status.playing) return;
    if (hasPreCachedForTrackRef.current === track.id) return;

    const currentTime = status.currentTime || 0;

    if (currentTime >= 30) {
      console.log(`[PRE-CACHE] Triggering pre-cache after ${Math.round(currentTime)}s for track: ${track.title}`);
      hasPreCachedForTrackRef.current = track.id;

      const getStreamUrlForTrack = async (trackId: string): Promise<string | null> => {
        try {
          const cachedPath = await cacheService.getCachedTrackPath(trackId);
          if (cachedPath) return null;

          const downloadedPath = await downloadService.getDownloadedTrackPath(trackId);
          if (downloadedPath) return null;

          const response = await retreatService.getTrackStreamUrl(trackId);
          return response.success ? response.url || null : null;
        } catch (error) {
          console.warn(`[PRE-CACHE] Failed to get stream URL for ${trackId}:`, error);
          return null;
        }
      };

      const currentRetreatId = metaRetreatId || track.session_id || 'unknown';
      cacheService.preCacheTracksForDuration(
        upcomingTracks.map(t => ({ id: t.id, duration: t.duration })),
        currentRetreatId,
        getStreamUrlForTrack,
        PRE_CACHE_DURATION_SECONDS
      ).catch(err => console.warn('[PRE-CACHE] Pre-cache failed:', err));
    }
  }, [track, status, playerState, upcomingTracks, metaRetreatId]);

  // --- Notify playing state change ---
  useEffect(() => {
    onPlayingStateChangeRef.current?.(isPlaying);
  }, [isPlaying]);

  // --- Load track audio source ---
  const loadTrack = async (newTrack: Track) => {
    try {
      console.log(`Loading track audio: ${newTrack.title} (ID: ${newTrack.id})`);
      const source = await getAudioSource(newTrack);
      if (source) {
        console.log(`Setting audio source for: ${newTrack.title}`);
        setAudioSource(source);
      } else {
        console.error(`Failed to get audio source for: ${newTrack.title}`);
      }
    } catch (error) {
      console.error('Error loading track:', error);
    }
  };

  // --- Get audio source (local or stream) with automatic caching ---
  const getAudioSource = async (targetTrack: Track): Promise<string | null> => {
    try {
      // 1. Check for explicitly downloaded track first
      const downloadedPath = await downloadService.getDownloadedTrackPath(targetTrack.id);
      if (downloadedPath) {
        console.log(`Using downloaded audio: ${targetTrack.title}`);
        setStreamLoadedTrackId(targetTrack.id);
        return downloadedPath;
      }

      // 2. Check for cached track
      const cachedPath = await cacheService.getCachedTrackPath(targetTrack.id);
      if (cachedPath) {
        console.log(`Using cached audio: ${targetTrack.title}`);
        setStreamLoadedTrackId(targetTrack.id);
        return cachedPath;
      }

      // 3. Stream from backend and cache in background
      console.log(`Streaming and caching: ${targetTrack.title}`);
      setIsStreamLoading(true);

      const response = await retreatService.getTrackStreamUrl(targetTrack.id);

      if (response.success && response.url) {
        console.log(`Got stream URL for: ${targetTrack.title}`);
        setStreamLoadedTrackId(targetTrack.id);
        setIsStreamLoading(false);

        // Cache the track in background
        const retreatIdForCache = targetTrack.session_id || 'unknown';
        cacheService.cacheTrack(targetTrack.id, retreatIdForCache, response.url)
          .then(() => {
            console.log(`Background cache complete: ${targetTrack.title}`);
          })
          .catch((cacheError) => {
            console.warn(`Background cache failed: ${targetTrack.title}`, cacheError);
          });

        return response.url;
      } else {
        setIsStreamLoading(false);
        throw new Error(response.error || 'Failed to get stream URL');
      }
    } catch (error) {
      console.error('Error getting audio source:', error);
      setIsStreamLoading(false);
      return null;
    }
  };

  // --- Restore saved position ---
  const restoreSavedPosition = async () => {
    if (!track || !player || !status?.isLoaded || playerState !== 'READY' || isRestorationInProgress) {
      console.log('Cannot restore position - requirements not met');
      return;
    }

    const currentTrackId = track.id;
    const restorationSessionId = `${currentTrackId}-${Date.now()}`;

    try {
      console.log(`Starting position restoration for ${track.title} (session: ${restorationSessionId})`);
      setIsRestorationInProgress(true);
      setRestorationTrackId(currentTrackId);
      currentRestorationSessionIdRef.current = restorationSessionId;
      setPlayerState('SEEKING');
      setIsSeekInProgress(true);

      const progressKey = `progress_${currentTrackId}`;
      const savedProgress = await AsyncStorage.getItem(progressKey);

      if (!track || track.id !== currentTrackId) {
        console.log(`Track changed during restoration (session: ${restorationSessionId})`);
        return;
      }

      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        const positionSeconds = progress.position;

        const maxDuration = status.duration || track.duration || 0;
        // Allow seek if we have a position, even when duration is unknown (0)
        if (positionSeconds > 0 && (maxDuration === 0 || positionSeconds < maxDuration - 1)) {
          console.log(`Restoring to saved position: ${positionSeconds}s / ${maxDuration}s`);

          setDisplayPosition(positionSeconds);
          setExpectedPosition(positionSeconds);

          const currentAudioSource = audioSource || '';
          const isStreamedTrack = currentAudioSource.startsWith('http://') || currentAudioSource.startsWith('https://');
          const stabilizationWait = isStreamedTrack ? 1200 : 600;

          console.log(`Waiting for audio to stabilize... (${stabilizationWait}ms for ${isStreamedTrack ? 'streamed' : 'local'} track)`);
          await new Promise(resolve => setTimeout(resolve, stabilizationWait));

          // Check if restoration session was cancelled during wait
          if (currentRestorationSessionIdRef.current !== restorationSessionId) {
            console.log(`Restoration session cancelled during stabilization (session: ${restorationSessionId})`);
            return;
          }

          if (!track || track.id !== currentTrackId) {
            console.log(`Track changed during stabilization wait (session: ${restorationSessionId})`);
            return;
          }

          const isPlayerStateValid = player &&
            status?.isLoaded &&
            (playerState as AudioPlayerState) !== 'LOADING';

          if (!isPlayerStateValid) {
            console.log(`Player state invalid during restoration (session: ${restorationSessionId})`);
            return;
          }

          try {
            const testValid = player && status?.isLoaded;
            if (!testValid) {
              console.log(`Player object validation failed (session: ${restorationSessionId})`);
              return;
            }
          } catch (validationError) {
            console.log(`Player object validation threw error (session: ${restorationSessionId}):`, validationError);
            return;
          }

          try {
            if (currentRestorationSessionIdRef.current !== restorationSessionId) {
              console.log(`Restoration session superseded (session: ${restorationSessionId})`);
              return;
            }

            if (loadedTrackId !== currentTrackId) {
              console.log(`Loaded track mismatch (session: ${restorationSessionId})`);
              return;
            }

            if (!track || track.id !== currentTrackId) {
              console.log(`Track changed just before seek (session: ${restorationSessionId})`);
              return;
            }

            if (!status?.isLoaded || !player) {
              console.log(`Player not ready for seek (session: ${restorationSessionId})`);
              return;
            }

            console.log(`Executing seek to ${positionSeconds}s (session: ${restorationSessionId})`);

            try {
              await player.seekTo(positionSeconds);
              console.log(`Seek completed successfully (session: ${restorationSessionId})`);

              await new Promise(resolve => setTimeout(resolve, 400));

              if (track && track.id === currentTrackId) {
                setPlayerPosition(positionSeconds);
                setRestorationProtection(true);
                console.log(`Position restoration completed: ${positionSeconds}s (session: ${restorationSessionId})`);
              }
            } catch (seekOperationError: any) {
              if (currentRestorationSessionIdRef.current === restorationSessionId) {
                const errorMessage = seekOperationError?.message || '';
                const isNativePlayerError = errorMessage.includes('SharedObject<AudioPlayer>') ||
                  errorMessage.includes('native shared object') ||
                  errorMessage.includes('Unable to find the native');

                if (isNativePlayerError) {
                  console.error(`Native player object error during restoration (session: ${restorationSessionId})`);
                  console.log(`Keeping display position at ${positionSeconds}s for user visibility`);
                } else {
                  console.error(`Seek operation failed (session: ${restorationSessionId}):`, seekOperationError);
                  setDisplayPosition(0);
                  setPlayerPosition(0);
                  setExpectedPosition(0);
                }
                setRestorationProtection(false);
              }
              return;
            }
          } catch (seekError) {
            if (currentRestorationSessionIdRef.current === restorationSessionId) {
              console.error(`Player seek failed during restoration (session: ${restorationSessionId}):`, seekError);
              if (track && track.id === currentTrackId) {
                setDisplayPosition(0);
                setPlayerPosition(0);
                setExpectedPosition(0);
                setRestorationProtection(false);
              }
            }
            return;
          }
        } else {
          console.log(`Invalid saved position (${positionSeconds}s), starting from beginning`);
          setDisplayPosition(0);
          setPlayerPosition(0);
          setExpectedPosition(0);
          setRestorationProtection(false);
        }
      } else {
        console.log(`No saved position, starting from beginning`);
        setDisplayPosition(0);
        setPlayerPosition(0);
        setExpectedPosition(0);
        setRestorationProtection(false);
      }
    } catch (error) {
      if (currentRestorationSessionIdRef.current === restorationSessionId) {
        console.error('Error during position restoration:', error);
        if (track && track.id === currentTrackId) {
          setRestorationProtection(false);
          setDisplayPosition(0);
          setPlayerPosition(0);
          setExpectedPosition(0);
        }
      }
    } finally {
      setIsSeekInProgress(false);
      setIsRestorationInProgress(false);

      if (track && track.id === currentTrackId && currentRestorationSessionIdRef.current === restorationSessionId) {
        setPlayerState('RESTORED');
        setIsTrackLoading(false);
        console.log(`Position restoration complete (session: ${restorationSessionId})`);
        safeClearSessionId("restoration completion", false);
      }
      setRestorationTrackId(null);
    }
  };

  // --- Save progress ---
  const saveProgress = async (currentPositionMs: number) => {
    if (!track || !status) return;

    try {
      const progress: UserProgress = {
        trackId: track.id,
        position: Math.floor(currentPositionMs / 1000),
        completed: (status.duration || track.duration || 0) > 0
          ? currentPositionMs >= ((status.duration || track.duration) * 1000 * 0.95)
          : false,
        lastPlayed: new Date().toISOString(),
        bookmarks: [],
      };

      const progressKey = `progress_${track.id}`;
      await AsyncStorage.setItem(progressKey, JSON.stringify(progress));
      onProgressUpdateRef.current?.(progress);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  // --- Toggle play/pause ---
  const togglePlayPause = useCallback(() => {
    if (!player || !status?.isLoaded || playerState === 'LOADING') return;

    if (isSeekInProgress && !status.playing) {
      console.log('Play blocked - seek in progress');
      return;
    }

    if (status.playing) {
      player.pause();
      setPlayerState('RESTORED');
    } else {
      player.play();
      setPlayerState('PLAYING');
    }
  }, [player, status, playerState, isSeekInProgress]);

  // --- Seek to position ---
  const seekToPosition = useCallback(async (positionMs: number) => {
    if (!player || !status?.isLoaded || !track || loadedTrackId !== track.id) {
      console.log('Cannot seek - audio not ready');
      setIsSeekInProgress(false);
      setPlayerState('RESTORED');
      return;
    }

    try {
      const positionSeconds = positionMs / 1000;
      console.log(`Manual seek to: ${positionSeconds}s`);

      const wasPlaying = status.playing;
      if (wasPlaying) {
        await player.pause();
      }

      setDisplayPosition(positionSeconds);
      setExpectedPosition(positionSeconds);

      if (!player || loadedTrackId !== track.id) {
        setIsSeekInProgress(false);
        setPlayerState('RESTORED');
        return;
      }

      await player.seekTo(positionSeconds);
      await new Promise(resolve => setTimeout(resolve, 300));

      setPlayerPosition(positionSeconds);
      console.log(`Manual seek completed: ${positionSeconds}s`);

      if (wasPlaying && player && loadedTrackId === track.id) {
        await player.play();
        setPlayerState('PLAYING');
        setRestorationProtection(false);
      } else {
        setPlayerState('RESTORED');
        setRestorationProtection(false);
      }

      await saveProgress(positionMs);
    } catch (error) {
      console.error('Error during manual seek:', error);
      setRestorationProtection(false);
      setPlayerState('RESTORED');
    } finally {
      setIsSeekInProgress(false);
    }
  }, [player, status, track, loadedTrackId]);

  // --- Change playback speed ---
  const changePlaybackSpeed = useCallback(() => {
    if (isPlayButtonDisabled || !player || !status?.isLoaded) return;

    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const newSpeed = speeds[(currentIndex + 1) % speeds.length];

    setPlaybackSpeed(newSpeed);
    player.setPlaybackRate(newSpeed, 'medium');
  }, [isPlayButtonDisabled, player, status, playbackSpeed]);

  // --- Skip backward 15 seconds ---
  const skipBackward = useCallback(() => {
    const newPosition = Math.max(0, displayPosition - 15);
    seekToPosition(newPosition * 1000);
  }, [displayPosition, seekToPosition]);

  // --- Skip forward 15 seconds ---
  const skipForward = useCallback(() => {
    const trackDuration = status?.duration || track?.duration || 0;
    const newPosition = Math.min(trackDuration, displayPosition + 15);
    seekToPosition(newPosition * 1000);
  }, [displayPosition, status, track, seekToPosition]);

  // --- Slider interaction handlers ---
  const onSlidingStart = useCallback(() => {
    console.log(`Slider interaction started at: ${displayPosition}s`);
    setPlayerState('SEEKING');
    setIsSeekInProgress(true);
  }, [displayPosition]);

  const onSlidingComplete = useCallback(async (value: number) => {
    console.log(`Slider released at: ${value}s`);
    await seekToPosition(value * 1000);
  }, [seekToPosition]);

  const onSliderValueChange = useCallback((value: number) => {
    if (playerState === 'SEEKING') {
      setDisplayPosition(value);
    }
  }, [playerState]);

  // --- Play a specific track ---
  const playTrack = useCallback((
    newTrack: Track,
    newTrackList: Track[],
    index: number,
    meta?: { retreatId: string; retreatName: string; groupName: string }
  ) => {
    setTrackListState(newTrackList);
    setCurrentTrackIndex(index);
    if (meta) {
      setMetaRetreatId(meta.retreatId);
      setMetaRetreatName(meta.retreatName);
      setMetaGroupName(meta.groupName);
    }
    // Setting track triggers the load effect
    setTrack(newTrack);
  }, []);

  // --- Next / previous track ---
  const nextTrackAction = useCallback(() => {
    onNextTrackRef.current?.();
  }, []);

  const previousTrackAction = useCallback(() => {
    onPreviousTrackRef.current?.();
  }, []);

  // --- Callback registration setters ---
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

  // --- Context value ---
  const value: AudioPlayerContextType = {
    // State
    currentTrack: track,
    isPlaying,
    position: displayPosition,
    duration,
    playbackSpeed,
    isLoading: isTrackLoading,
    playerState,
    trackList: trackListState,
    currentTrackIndex,
    retreatId: metaRetreatId,
    retreatName: metaRetreatName,
    groupName: metaGroupName,
    isPlayButtonDisabled,
    hasNextTrack,
    hasPreviousTrack,

    // Actions
    playTrack,
    togglePlayPause,
    seekTo: seekToPosition,
    skipForward,
    skipBackward,
    nextTrack: nextTrackAction,
    previousTrack: previousTrackAction,
    changePlaybackSpeed,
    setUpcomingTracks,

    // Slider interaction
    onSlidingStart,
    onSlidingComplete,
    onSliderValueChange,

    // Callback registration
    setOnProgressUpdate,
    setOnTrackComplete,
    setOnPlayingStateChange,
    setOnNextTrack,
    setOnPreviousTrack,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}
