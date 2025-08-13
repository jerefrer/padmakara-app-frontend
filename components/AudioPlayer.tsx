import retreatService from '@/services/retreatService';
import { Track, UserProgress } from '@/types';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const colors = {
  burgundy: {
    500: '#b91c1c',
    600: '#991b1b',
  },
  gray: {
    100: '#f3f4f6',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
  },
  white: '#ffffff',
};

// Audio player state machine
type AudioPlayerState = 'LOADING' | 'READY' | 'RESTORED' | 'PLAYING' | 'SEEKING';

interface AudioPlayerProps {
  track: Track | null;
  onProgressUpdate?: (progress: UserProgress) => void;
  onTrackComplete?: () => void;
  onNextTrack?: () => void;
  onPreviousTrack?: () => void;
  onPlayingStateChange?: (isPlaying: boolean) => void;
}

export function AudioPlayer({ 
  track, 
  onProgressUpdate,
  onTrackComplete,
  onNextTrack,
  onPreviousTrack,
  onPlayingStateChange
}: AudioPlayerProps) {
  // State machine and core state
  const [playerState, setPlayerState] = useState<AudioPlayerState>('LOADING');
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [loadedTrackId, setLoadedTrackId] = useState<string | null>(null);
  
  // Position state - single source of truth
  const [playerPosition, setPlayerPosition] = useState(0); // Actual player position
  const [displayPosition, setDisplayPosition] = useState(0); // UI display position
  const [restorationProtection, setRestorationProtection] = useState(false); // Prevent immediate overwrites
  const [expectedPosition, setExpectedPosition] = useState(0); // Position we expect player to reach
  const [isSeekInProgress, setIsSeekInProgress] = useState(false); // Track active seek operations
  const [pendingTimeouts, setPendingTimeouts] = useState<NodeJS.Timeout[]>([]); // Track timeouts for cleanup
  const [isRestorationInProgress, setIsRestorationInProgress] = useState(false); // Prevent concurrent restorations
  const [restorationTrackId, setRestorationTrackId] = useState<string | null>(null); // Track which track is being restored
  const currentRestorationSessionIdRef = useRef<string | null>(null); // Track current active restoration session - using ref to prevent React state interference
  const [isStreamLoading, setIsStreamLoading] = useState(false); // Track if stream URL is being fetched
  const [streamLoadedTrackId, setStreamLoadedTrackId] = useState<string | null>(null); // Track which track has stream loaded
  const [isTrackLoading, setIsTrackLoading] = useState(false); // Overall track loading state for UI feedback
  
  // Audio player hooks
  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);
  
  // Safe session ID clearing with protection
  const safeClearSessionId = (reason: string, force: boolean = false) => {
    console.log(`🔍 [SESSION] Attempting to clear session ID: reason="${reason}", force=${force}, isRestorationInProgress=${isRestorationInProgress}, currentSessionId=${currentRestorationSessionIdRef.current}`);
    
    if (!force && isRestorationInProgress) {
      console.log(`🛡️ [SESSION] Blocked session ID clearing during active restoration: reason="${reason}"`);
      return false;
    }
    
    console.log(`✅ [SESSION] Clearing session ID: ${currentRestorationSessionIdRef.current} → null (reason: ${reason})`);
    currentRestorationSessionIdRef.current = null;
    return true;
  };
  
  // Get remembered position for optimistic display
  const getRememberedPosition = async (trackId: string): Promise<{ position: number; duration: number }> => {
    try {
      const progressKey = `progress_${trackId}`;
      const savedProgress = await AsyncStorage.getItem(progressKey);
      
      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        return {
          position: progress.position || 0,
          duration: track?.duration || 1800 // Use track duration or default
        };
      }
    } catch (error) {
      console.error('Error getting remembered position:', error);
    }
    
    return { position: 0, duration: track?.duration || 1800 };
  };
  
  // Setup audio session on mount
  useEffect(() => {
    setAudioModeAsync({
      allowsRecording: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);
  
  // Load new track - reset all state and cancel pending operations
  useEffect(() => {
    // Cancel all pending timeouts when switching tracks
    pendingTimeouts.forEach(timeout => clearTimeout(timeout));
    setPendingTimeouts([]);
    
    if (track) {
      console.log(`🔄 Loading new track: ${track.title} (${track.id})`);
      console.log(`🔍 [DEBUG] Track loading effect: loadedTrackId=${loadedTrackId}, isRestorationInProgress=${isRestorationInProgress}, restorationTrackId=${restorationTrackId}`);
      
      // Skip if this is the same track that's already loaded and being restored
      if (loadedTrackId === track.id && isRestorationInProgress && restorationTrackId === track.id) {
        console.log(`🔍 [DEBUG] Skipping track loading - same track already loaded and being restored: ${track.id}`);
        return;
      }
      
      // Cancel any ongoing restoration by clearing all restoration tracking
      if (isRestorationInProgress) {
        console.log('🚫 Cancelling ongoing restoration for track switch');
        console.log(`🔍 [DEBUG] Explicitly cancelling restoration for track switch: ${currentRestorationSessionIdRef.current} → null`);
        setRestorationTrackId(null);
        safeClearSessionId("track switch cancellation", true); // Force clear for track switch
      }
      
      // Start loading state immediately for smooth UX
      setIsTrackLoading(true);
      
      // Set optimistic display with remembered position
      const setupOptimisticDisplay = async () => {
        const remembered = await getRememberedPosition(track.id);
        console.log(`🎯 Setting optimistic display: position=${remembered.position}s, duration=${remembered.duration}s`);
        
        setDisplayPosition(remembered.position);
        setPlayerPosition(remembered.position);
        setExpectedPosition(remembered.position);
        
        // Don't reset other states until we start loading
        setPlayerState('LOADING');
        setLoadedTrackId(null);
        setRestorationProtection(false);
        setIsSeekInProgress(false);
        setIsRestorationInProgress(false);
        setRestorationTrackId(null);
        setIsStreamLoading(false);
        setStreamLoadedTrackId(null);
        console.log(`🔍 [DEBUG] Track loading: Clearing currentRestorationSessionId: ${currentRestorationSessionIdRef.current} → null`);
        safeClearSessionId("track loading reset", false);
        
        loadTrack(track);
      };
      
      setupOptimisticDisplay();
    } else {
      console.log('🔄 No track selected, resetting');
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
      console.log(`🔍 [DEBUG] No track: Clearing currentRestorationSessionId: ${currentRestorationSessionIdRef.current} → null`);
      safeClearSessionId("no track reset", false);
    }
  }, [track]);
  
  // Handle audio loading and restoration
  useEffect(() => {
    if (!status || !track) return;
    
    console.log(`📊 Status: ${playerState}, isLoaded: ${status.isLoaded}, duration: ${status.duration}, currentTime: ${status.currentTime}`);
    console.log(`🔍 [DEBUG] Restoration effect: playerState=${playerState}, isRestorationInProgress=${isRestorationInProgress}, currentRestorationSessionId=${currentRestorationSessionIdRef.current}`);
    
    // Prevent effect from running during active restoration to avoid self-interference
    if (isRestorationInProgress) {
      console.log('🔍 [DEBUG] Skipping restoration effect - restoration already in progress');
      return;
    }
    
    // State machine transitions - prevent duplicate loading for same track
    if (playerState === 'LOADING' && status.isLoaded && status.duration > 0 && loadedTrackId !== track.id) {
      console.log(`✅ Audio loaded: ${track.title} (${track.id}) - Duration: ${status.duration}s`);
      setLoadedTrackId(track.id);
      
      // Wait a bit longer before transitioning to READY for subsequent tracks  
      const isFirstLoad = loadedTrackId === null;
      const delay = isFirstLoad ? 100 : 800; // Longer delay for subsequent tracks
      
      const timeout = setTimeout(() => {
        console.log(`✅ Audio stabilized - transitioning to READY (delay: ${delay}ms)`);
        console.log(`🔍 [DEBUG] Before READY transition: currentRestorationSessionId=${currentRestorationSessionIdRef.current}`);
        setPlayerState('READY');
      }, delay);
      
      // Track timeout for cleanup
      setPendingTimeouts(prev => [...prev, timeout]);
    }
    
    // Automatic restoration when ready (prevent concurrent attempts)
    // Wait for audio source loading to complete before restoration
    
    // Check if the current track has completed its loading process
    // streamLoadedTrackId gets set for both local and streamed tracks when loading completes
    const isAudioSourceReady = streamLoadedTrackId === track.id;
    
    if (playerState === 'READY' && loadedTrackId === track.id && !isRestorationInProgress && isAudioSourceReady) {
      console.log(`🎯 Auto-restoring position for: ${track.title} (audioSourceReady: ${isAudioSourceReady}, streamLoadedTrackId: ${streamLoadedTrackId})`);
      restoreSavedPosition();
    } else if (playerState === 'READY' && loadedTrackId === track.id && !isRestorationInProgress && !isAudioSourceReady) {
      console.log(`⏳ Waiting for audio source to be ready for restoration: ${track.title} (streamLoading: ${isStreamLoading}, streamLoadedTrackId: ${streamLoadedTrackId})`);
    }
  }, [status, track, playerState, loadedTrackId, isRestorationInProgress, audioSource, isStreamLoading, streamLoadedTrackId]);
  
  // Handle position updates during normal playback
  useEffect(() => {
    if (!status || !track) {
      return;
    }
    
    // Allow position updates during PLAYING and after manual seeks complete
    if (playerState !== 'PLAYING' && playerState !== 'SEEKING') {
      return;
    }
    
    if (loadedTrackId !== track.id || status.currentTime === undefined) {
      return;
    }
    
    // State-based protection: Check if we're waiting for seek completion
    if (restorationProtection) {
      const positionDiff = Math.abs(status.currentTime - expectedPosition);
      console.log(`🛡️ Protection active - status: ${status.currentTime}s, expected: ${expectedPosition}s, diff: ${positionDiff}s`);
      
      // More forgiving tolerance for manual seeks during playback (3 seconds)
      // Less forgiving for restoration seeks (2 seconds)
      const tolerance = playerState === 'PLAYING' ? 3 : 2;
      
      if (positionDiff <= tolerance) {
        console.log(`✅ Player reached expected position (tolerance: ${tolerance}s) - clearing protection`);
        setRestorationProtection(false);
        setIsSeekInProgress(false);
      } else {
        // Still waiting for player to catch up
        return;
      }
    }
    
    // Update positions only if not currently seeking via slider
    if (playerState !== 'SEEKING') {
      console.log(`🔄 Updating positions - ${status.currentTime}s`);
      console.log(`🔍 [DEBUG] Position update: playerState=${playerState}, restorationProtection=${restorationProtection}, expectedPosition=${expectedPosition}`);
      setPlayerPosition(status.currentTime);
      setDisplayPosition(status.currentTime);
    } else {
      console.log(`🔍 [DEBUG] Skipping position update - playerState=${playerState} (SEEKING)`);
    }
    
    // Save progress every 10 seconds (only during normal playback)
    if (playerState === 'PLAYING') {
      const currentSeconds = Math.floor(status.currentTime);
      if (currentSeconds > 0 && currentSeconds % 10 === 0) {
        console.log(`💾 Auto-saving progress at ${currentSeconds}s`);
        saveProgress(status.currentTime * 1000);
      }
    }
    
    // Check for completion
    if (status.didJustFinish || (status.currentTime >= status.duration && status.duration > 0)) {
      console.log('🏁 Track completed');
      saveProgress(status.duration * 1000);
      onTrackComplete?.();
    }
  }, [status, track, playerState, loadedTrackId, restorationProtection, expectedPosition]);
  
  // Load track audio source
  const loadTrack = async (newTrack: Track) => {
    try {
      console.log(`🎵 Loading track: ${newTrack.title} (ID: ${newTrack.id})`);
      
      // Get audio source (local or stream)
      const source = await getAudioSource(newTrack);
      if (source) {
        console.log(`📻 Setting audio source for: ${newTrack.title}`);
        setAudioSource(source);
        console.log(`✅ Audio source set for: ${newTrack.title}`);
      } else {
        console.error(`❌ Failed to get audio source for: ${newTrack.title}`);
      }
    } catch (error) {
      console.error('Error loading track:', error);
    }
  };
  
  // Get audio source (local or stream)
  const getAudioSource = async (track: Track): Promise<string | null> => {
    try {
      // Check for local download first
      const isDownloaded = await retreatService.isTrackDownloaded(track.id);
      
      if (isDownloaded) {
        const localPath = await retreatService.getDownloadedTrackPath(track.id);
        if (localPath) {
          console.log(`🎵 Using local audio: ${track.title}`);
          setStreamLoadedTrackId(track.id); // Mark as ready (local tracks are immediately ready)
          return localPath;
        }
      }
      
      // Get stream URL from backend
      console.log(`🌐 Getting stream URL for: ${track.title}`);
      setIsStreamLoading(true);
      
      const response = await retreatService.getTrackStreamUrl(track.id);
      
      if (response.success && response.url) {
        console.log(`✅ Got stream URL for: ${track.title}`);
        setStreamLoadedTrackId(track.id); // Mark stream as loaded
        setIsStreamLoading(false);
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
  
  // Restore saved position with proper error handling and state cleanup
  const restoreSavedPosition = async () => {
    if (!track || !player || !status?.isLoaded || playerState !== 'READY' || isRestorationInProgress) {
      console.log('❌ Cannot restore position - requirements not met');
      return;
    }
    
    const currentTrackId = track.id;
    
    // Create a restoration session ID to track this specific restoration
    const restorationSessionId = `${currentTrackId}-${Date.now()}`;
    
    try {
      console.log(`🔄 Starting position restoration for ${track.title} (session: ${restorationSessionId})`);
      console.log(`🔍 [DEBUG] Session state: currentRestorationSessionId=${currentRestorationSessionIdRef.current}, loadedTrackId=${loadedTrackId}, currentTrackId=${currentTrackId}`);
      setIsRestorationInProgress(true);
      setRestorationTrackId(currentTrackId);
      currentRestorationSessionIdRef.current = restorationSessionId; // Set current active session
      console.log(`🔍 [DEBUG] Set currentRestorationSessionId to: ${restorationSessionId}`);
      setPlayerState('SEEKING');
      setIsSeekInProgress(true);
      
      const progressKey = `progress_${currentTrackId}`;
      const savedProgress = await AsyncStorage.getItem(progressKey);
      
      // Check if track changed during async operations
      if (!track || track.id !== currentTrackId) {
        console.log(`⚠️ Track changed during restoration (session: ${restorationSessionId}) - track.id: "${track?.id}", currentTrackId: "${currentTrackId}"`);
        return;
      }
      
      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        const positionSeconds = progress.position;
        
        // Ensure position is valid
        const maxDuration = status.duration || track.duration || 0;
        if (positionSeconds > 0 && positionSeconds < maxDuration - 1) {
          console.log(`🎯 Restoring to saved position: ${positionSeconds}s / ${maxDuration}s`);
          
          // Update display position immediately
          setDisplayPosition(positionSeconds);
          setExpectedPosition(positionSeconds);
          
          // Wait for audio to stabilize - longer wait for streamed tracks
          // Check the actual current audio source to determine stream vs local
          const currentAudioSource = audioSource || '';
          const isStreamedTrack = currentAudioSource.startsWith('http://') || currentAudioSource.startsWith('https://');
          const stabilizationWait = isStreamedTrack ? 1200 : 600; // 1.2s for streamed, 0.6s for local
          
          console.log(`⏳ Waiting for audio to stabilize... (${stabilizationWait}ms wait for ${isStreamedTrack ? 'streamed' : 'local'} track)`);
          console.log(`🔍 Audio source type: ${isStreamedTrack ? 'HTTPS/HTTP stream' : 'Local file'} - ${currentAudioSource.substring(0, 50)}${currentAudioSource.length > 50 ? '...' : ''}`);
          await new Promise(resolve => setTimeout(resolve, stabilizationWait));
          
          // Check if restoration session was cancelled during wait
          if (currentRestorationSessionIdRef.current !== restorationSessionId) {
            console.log(`⚠️ Restoration session cancelled during stabilization wait (session: ${restorationSessionId}), current: ${currentRestorationSessionIdRef.current}, aborting`);
            return;
          }
          
          // Check again if track changed during wait
          if (!track || track.id !== currentTrackId) {
            console.log(`⚠️ Track changed during stabilization wait (session: ${restorationSessionId}), aborting`);
            return;
          }
          
          // Enhanced player validation for both state and native object integrity
          console.log(`🔍 Player validation (session: ${restorationSessionId}): player=${!!player}, status.isLoaded=${status?.isLoaded}, playerState=${playerState}, status.currentTime=${status?.currentTime}`);
          
          const isPlayerStateValid = player && 
                                   status?.isLoaded && 
                                   playerState !== 'LOADING' &&
                                   typeof status.duration === 'number' &&
                                   status.duration > 0;
                               
          if (!isPlayerStateValid) {
            console.log(`⚠️ Player state invalid during restoration (session: ${restorationSessionId}), aborting`);
            return;
          }
          
          // Test player object validity with a safe operation before seeking
          try {
            // Try to access a simple player property to verify the native object is valid
            const testValid = player && status?.isLoaded;
            if (!testValid) {
              console.log(`⚠️ Player object validation failed (session: ${restorationSessionId}), aborting`);
              return;
            }
          } catch (validationError) {
            console.log(`⚠️ Player object validation threw error (session: ${restorationSessionId}):`, validationError);
            return;
          }
          
          // Double-check player object validity with try-catch
          try {
            // Enhanced session validation - check if this session is still active
            console.log(`🔍 [DEBUG] Validation check: currentRestorationSessionId=${currentRestorationSessionIdRef.current}, restorationSessionId=${restorationSessionId}`);
            if (currentRestorationSessionIdRef.current !== restorationSessionId) {
              console.log(`⚠️ Restoration session superseded (session: ${restorationSessionId}), current: ${currentRestorationSessionIdRef.current}, aborting`);
              return;
            }
            
            // Check if loaded track matches the session track
            console.log(`🔍 [DEBUG] Track validation: loadedTrackId=${loadedTrackId}, currentTrackId=${currentTrackId}`);
            if (loadedTrackId !== currentTrackId) {
              console.log(`⚠️ Loaded track mismatch (session: ${restorationSessionId}), loaded: ${loadedTrackId}, expected: ${currentTrackId}, aborting`);
              return;
            }
            
            // Final check before seek
            if (!track || track.id !== currentTrackId) {
              console.log(`⚠️ Track changed just before seek (session: ${restorationSessionId}), aborting`);
              return;
            }
            
            // Test player object validity before seeking
            if (!status?.isLoaded) {
              console.log(`⚠️ Player not loaded during restoration (session: ${restorationSessionId}), aborting`);
              return;
            }
            
            // Additional player object validation
            if (!player) {
              console.log(`⚠️ Player object is null during restoration (session: ${restorationSessionId}), aborting`);
              return;
            }
            
            // Perform the seek with error handling
            console.log(`🎯 Executing seek to ${positionSeconds}s (session: ${restorationSessionId})`);
            console.log(`🔍 [DEBUG] Player state before seek: isLoaded=${status?.isLoaded}, currentTime=${status?.currentTime}, duration=${status?.duration}`);
            
            try {
              await player.seekTo(positionSeconds);
              console.log(`✅ Seek operation completed successfully (session: ${restorationSessionId})`);
              
              // Wait for seek completion
              await new Promise(resolve => setTimeout(resolve, 400));
              
              // Verify the seek actually worked by checking current position
              const currentTime = status?.currentTime || 0;
              const seekDiff = Math.abs(currentTime - positionSeconds);
              console.log(`🔍 Post-seek verification: expected ${positionSeconds}s, actual ${currentTime}s, diff: ${seekDiff}s`);
              
              // Final validation after seek
              console.log(`🔍 [DEBUG] Final validation: track.id=${track?.id}, currentTrackId=${currentTrackId}, match=${track && track.id === currentTrackId}`);
              if (track && track.id === currentTrackId) {
                setPlayerPosition(positionSeconds);
                setRestorationProtection(true);
                console.log(`✅ Position restoration completed: ${positionSeconds}s (session: ${restorationSessionId})`);
                console.log(`🔍 [DEBUG] Set playerPosition=${positionSeconds}, restorationProtection=true`);
              } else {
                console.log(`⚠️ Track changed after seek, position not applied (session: ${restorationSessionId})`);
              }
            } catch (seekOperationError) {
              // Only log errors for active sessions, not cancelled ones
              if (currentRestorationSessionIdRef.current === restorationSessionId) {
                // Check if this is a native player object error
                const errorMessage = seekOperationError?.message || '';
                const isNativePlayerError = errorMessage.includes('SharedObject<AudioPlayer>') || 
                                          errorMessage.includes('native shared object') ||
                                          errorMessage.includes('Unable to find the native');
                
                if (isNativePlayerError) {
                  console.error(`❌ Native player object error during restoration (session: ${restorationSessionId}): Player object became invalid`);
                  console.log(`🔧 This typically happens when switching from local to streamed tracks`);
                  
                  // For native player errors, keep display position but don't set protection
                  // The user will see the correct position on the slider, and manual operations will work
                  console.log(`🎚️ Keeping display position at ${positionSeconds}s for user visibility`);
                } else {
                  console.error(`❌ Seek operation failed (session: ${restorationSessionId}):`, seekOperationError);
                  
                  // Reset display position to match reality (0s) for other errors
                  setDisplayPosition(0);
                  setPlayerPosition(0);
                  setExpectedPosition(0);
                }
                setRestorationProtection(false);
              } else {
                console.log(`⚠️ Seek operation failed for cancelled session (session: ${restorationSessionId}), ignoring error`);
              }
              return;
            }
          } catch (seekError) {
            // Only log errors for active sessions, not cancelled ones
            if (currentRestorationSessionIdRef.current === restorationSessionId) {
              console.error(`❌ Player seek failed during restoration (session: ${restorationSessionId}):`, seekError);
              // Only reset if we're still on the same track
              if (track && track.id === currentTrackId) {
                setDisplayPosition(0);
                setPlayerPosition(0);
                setExpectedPosition(0);
                setRestorationProtection(false);
              }
            } else {
              console.log(`⚠️ Player seek failed for cancelled session (session: ${restorationSessionId}), ignoring error`);
            }
            return;
          }
        } else {
          console.log(`⚠️ Invalid saved position (${positionSeconds}s), starting from beginning`);
          setDisplayPosition(0);
          setPlayerPosition(0);
          setExpectedPosition(0);
          setRestorationProtection(false);
        }
      } else {
        console.log(`📄 No saved position, starting from beginning`);
        setDisplayPosition(0);
        setPlayerPosition(0);
        setExpectedPosition(0);
        setRestorationProtection(false);
      }
    } catch (error) {
      // Only log errors for active sessions, not cancelled ones
      if (currentRestorationSessionIdRef.current === restorationSessionId) {
        console.error('❌ Error during position restoration:', error);
        // Only reset if we're still on the same track
        if (track && track.id === currentTrackId) {
          setRestorationProtection(false);
          setDisplayPosition(0);
          setPlayerPosition(0);
          setExpectedPosition(0);
        }
      } else {
        console.log(`⚠️ Position restoration error for cancelled session (session: ${restorationSessionId}), ignoring`);
      }
    } finally {
      // Always clean up flags (since we use local currentTrackId for validation)
      setIsSeekInProgress(false);
      setIsRestorationInProgress(false);
      
      // Only update player state if we're still on the same track and this is the active session
      console.log(`🔍 [DEBUG] Finally block: track.id=${track?.id}, currentTrackId=${currentTrackId}, currentRestorationSessionId=${currentRestorationSessionIdRef.current}, restorationSessionId=${restorationSessionId}`);
      if (track && track.id === currentTrackId && currentRestorationSessionIdRef.current === restorationSessionId) {
        setPlayerState('RESTORED');
        setIsTrackLoading(false); // Clear loading state when restoration completes
        console.log(`🎯 Position restoration complete (session: ${restorationSessionId}) - seekInProgress: false`);
        console.log(`🔍 [DEBUG] Clearing currentRestorationSessionId: ${restorationSessionId} → null`);
        safeClearSessionId("restoration completion", false); // Clear the current session
      } else {
        console.log(`🔄 Restoration cleanup - track changed or session cancelled during restoration (session: ${restorationSessionId})`);
      }
      setRestorationTrackId(null);
    }
  };
  
  // Save progress
  const saveProgress = async (currentPositionMs: number) => {
    if (!track || !status) return;
    
    try {
      const progress: UserProgress = {
        trackId: track.id,
        position: Math.floor(currentPositionMs / 1000),
        completed: currentPositionMs >= (status.duration * 1000 * 0.95),
        lastPlayed: new Date().toISOString(),
        bookmarks: [],
      };
      
      const progressKey = `progress_${track.id}`;
      await AsyncStorage.setItem(progressKey, JSON.stringify(progress));
      onProgressUpdate?.(progress);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };
  
  // Toggle play/pause with seek-aware state management
  const togglePlayPause = () => {
    console.log(`🔍 [DEBUG] togglePlayPause called: playerState=${playerState}, isSeekInProgress=${isSeekInProgress}, status.playing=${status?.playing}, status.currentTime=${status?.currentTime}`);
    
    if (!player || !status?.isLoaded || playerState === 'LOADING') {
      console.log(`⚠️ [DEBUG] Play blocked - player not ready: player=${!!player}, isLoaded=${status?.isLoaded}, playerState=${playerState}`);
      return;
    }
    
    // Block play if seek is in progress
    if (isSeekInProgress && !status.playing) {
      console.log(`⚠️ Play blocked - seek in progress`);
      return;
    }
    
    if (status.playing) {
      player.pause();
      setPlayerState('RESTORED'); // Paused state
      console.log(`⏸️ Playback paused - state: RESTORED`);
    } else {
      console.log(`🔍 [DEBUG] Starting playback: playerPosition=${playerPosition}, displayPosition=${displayPosition}, expectedPosition=${expectedPosition}, status.currentTime=${status.currentTime}`);
      player.play();
      setPlayerState('PLAYING'); // Playing state
      console.log(`▶️ Playbook started - state: PLAYING, expected position: ${expectedPosition}s`);
    }
  };
  
  // Seek to position with proper error handling
  const seekTo = async (positionMs: number) => {
    if (!player || !status?.isLoaded || !track || loadedTrackId !== track.id) {
      console.log('❌ Cannot seek - audio not ready');
      setIsSeekInProgress(false);
      setPlayerState('RESTORED');
      return;
    }
    
    try {
      const positionSeconds = positionMs / 1000;
      console.log(`🎯 Manual seek to: ${positionSeconds}s`);
      
      // Check if playback was active before seek
      const wasPlaying = status.playing;
      if (wasPlaying) {
        await player.pause();
        console.log('⏸️ Paused player for seek');
      }
      
      // Update display position immediately
      setDisplayPosition(positionSeconds);
      setExpectedPosition(positionSeconds);
      
      // Validate player before seeking
      if (!player || loadedTrackId !== track.id) {
        console.log('⚠️ Player became invalid during seek, aborting');
        setIsSeekInProgress(false);
        setPlayerState('RESTORED');
        return;
      }
      
      // Perform the seek
      await player.seekTo(positionSeconds);
      
      // Wait for seek completion
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setPlayerPosition(positionSeconds);
      console.log(`✅ Manual seek completed: ${positionSeconds}s`);
      
      // Resume playback if it was playing before
      if (wasPlaying && player && loadedTrackId === track.id) {
        await player.play();
        setPlayerState('PLAYING');
        console.log('▶️ Resumed playback after seek');
        
        // For manual seeks during playback, clear protection immediately and start normal updates
        setRestorationProtection(false);
      } else {
        // For seeks while paused, go to restored state
        setPlayerState('RESTORED');
        setRestorationProtection(false);
      }
      
      // Save progress after seek
      await saveProgress(positionMs);
      
    } catch (error) {
      console.error('❌ Error during manual seek:', error);
      setRestorationProtection(false);
      setPlayerState('RESTORED');
    } finally {
      setIsSeekInProgress(false);
      console.log(`🎯 Seek complete - seekInProgress: false`);
    }
  };
  
  // Change playback speed
  const changePlaybackSpeed = () => {
    // Don't change speed if audio is loading or seeking
    if (isPlayButtonDisabled || !player || !status?.isLoaded) {
      return;
    }
    
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const newSpeed = speeds[(currentIndex + 1) % speeds.length];
    
    setPlaybackSpeed(newSpeed);
    player.setPlaybackRate(newSpeed, 'medium');
  };

  // Skip backward 15 seconds
  const skipBackward = () => {
    const currentPosition = displayPosition;
    const newPosition = Math.max(0, currentPosition - 15);
    console.log(`⏪ Skip backward: ${currentPosition}s → ${newPosition}s`);
    seekTo(newPosition * 1000);
  };

  // Skip forward 15 seconds
  const skipForward = () => {
    const currentPosition = displayPosition;
    const duration = status?.duration || track.duration || 0;
    const newPosition = Math.min(duration, currentPosition + 15);
    console.log(`⏩ Skip forward: ${currentPosition}s → ${newPosition}s`);
    seekTo(newPosition * 1000);
  };
  
  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Use display position for all UI elements (calculate before early return)
  const duration = status?.duration || track?.duration || 0;
  const isPlaying = status?.playing || false;
  const isLoading = playerState === 'LOADING';
  const isPlayButtonDisabled = isLoading || isSeekInProgress;
  
  // Call parent callback when playing state changes (before early return)
  useEffect(() => {
    onPlayingStateChange?.(isPlaying);
  }, [isPlaying, onPlayingStateChange]);
  
  // Don't render if no track
  if (!track) {
    return null;
  }
  
  console.log(`🖥️ Display: ${displayPosition}s/${duration}s, State: ${playerState}, Playing: ${isPlaying}, SeekInProgress: ${isSeekInProgress}`);
  
  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <Slider
          style={styles.progressBar}
          minimumValue={0}
          maximumValue={Math.max(duration, 1)}
          value={displayPosition}
          onSlidingStart={() => {
            console.log(`🎚️ Slider interaction started at: ${displayPosition}s`);
            setPlayerState('SEEKING');
            setIsSeekInProgress(true);
          }}
          onSlidingComplete={async (value) => {
            console.log(`🎚️ Slider released at: ${value}s`);
            await seekTo(value * 1000);
          }}
          onValueChange={(value) => {
            if (playerState === 'SEEKING') {
              setDisplayPosition(value);
            }
          }}
          minimumTrackTintColor={colors.burgundy[500]}
          maximumTrackTintColor={colors.gray[400]}
          thumbStyle={styles.progressThumb}
        />
      </View>
      
      {/* Player content */}
      <View style={styles.playerContent}>
        {/* Track info - title and duration on separate lines */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={2}>
            {track.title}
          </Text>
          <Text style={styles.trackTime}>
            {formatTime(displayPosition)} / {formatTime(duration)}
          </Text>
        </View>
        
        {/* Controls - centered below track info */}
        <View style={styles.controlsContainer}>
          <View style={styles.controls}>
            {/* Previous track */}
            <TouchableOpacity 
              onPress={onPreviousTrack}
              style={[styles.controlButton, !onPreviousTrack && styles.controlDisabled]}
              disabled={!onPreviousTrack}
            >
              <Ionicons name="play-skip-back" size={22} color={onPreviousTrack ? colors.gray[700] : colors.gray[400]} />
            </TouchableOpacity>
            
            {/* -15s button */}
            <TouchableOpacity 
              onPress={skipBackward}
              style={[styles.circularSkipButton, isPlayButtonDisabled && styles.controlDisabled]}
              disabled={isPlayButtonDisabled}
            >
              <FontAwesome 
                name="rotate-left" 
                size={32} 
                color={isPlayButtonDisabled ? colors.gray[400] : colors.gray[700]}
                style={styles.skipIcon}
              />
              <Text style={[styles.skipNumber, isPlayButtonDisabled && styles.skipNumberDisabled]}>15</Text>
            </TouchableOpacity>
            
            {/* Play/Pause button */}
            <TouchableOpacity 
              onPress={togglePlayPause}
              style={[styles.playButton, isPlayButtonDisabled && styles.playButtonDisabled]}
              disabled={isPlayButtonDisabled}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={26} 
                color={colors.white} 
              />
            </TouchableOpacity>
            
            {/* +15s button */}
            <TouchableOpacity 
              onPress={skipForward}
              style={[styles.circularSkipButton, isPlayButtonDisabled && styles.controlDisabled]}
              disabled={isPlayButtonDisabled}
            >
              <FontAwesome 
                name="rotate-right" 
                size={32} 
                color={isPlayButtonDisabled ? colors.gray[400] : colors.gray[700]}
                style={styles.skipIcon}
              />
              <Text style={[styles.skipNumber, isPlayButtonDisabled && styles.skipNumberDisabled]}>15</Text>
            </TouchableOpacity>
            
            {/* Next track */}
            <TouchableOpacity 
              onPress={onNextTrack}
              style={[styles.controlButton, !onNextTrack && styles.controlDisabled]}
              disabled={!onNextTrack}
            >
              <Ionicons name="play-skip-forward" size={22} color={onNextTrack ? colors.gray[700] : colors.gray[400]} />
            </TouchableOpacity>
          </View>
          
          {/* Speed control positioned absolutely */}
          <TouchableOpacity 
            onPress={changePlaybackSpeed} 
            style={[styles.speedButton, isPlayButtonDisabled && styles.speedButtonDisabled]}
            disabled={isPlayButtonDisabled}
          >
            <Text style={[styles.speedText, isPlayButtonDisabled && styles.speedTextDisabled]}>{playbackSpeed}x</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Loading Overlay */}
      {isTrackLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.burgundy[500]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray[400],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  progressContainer: {
    height: 4,
  },
  progressBar: {
    height: 4,
    marginHorizontal: 0,
  },
  progressThumb: {
    width: 12,
    height: 12,
    backgroundColor: colors.burgundy[500],
  },
  playerContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 88,
  },
  trackInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[800],
    textAlign: 'center',
    marginBottom: 4,
  },
  trackTime: {
    fontSize: 13,
    color: colors.gray[500],
    textAlign: 'center',
  },
  controlsContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  controlButton: {
    padding: 10,
  },
  controlDisabled: {
    opacity: 0.5,
  },
  playButton: {
    backgroundColor: colors.burgundy[500],
    borderRadius: 24,
    padding: 10,
    marginHorizontal: 8,
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  circularSkipButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipIcon: {
    // Remove absolute positioning
  },
  skipNumber: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.gray[700],
    textAlign: 'center',
    position: 'absolute', // Position text over the icon
  },
  skipNumberDisabled: {
    color: colors.gray[400],
  },
  speedButton: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -14 }], // Slightly higher to align better with other controls
    backgroundColor: colors.gray[100],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  speedButtonDisabled: {
    opacity: 0.5,
    backgroundColor: colors.gray[200],
  },
  speedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  speedTextDisabled: {
    color: colors.gray[400],
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingBottom: 28, // Adjusted to align with controls center
    paddingLeft: 16, // Match controls container padding
    zIndex: 1000,
  },
});