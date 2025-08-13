import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track, UserProgress } from '@/types';
import retreatService from '@/services/retreatService';

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
}

export function AudioPlayer({ 
  track, 
  onProgressUpdate,
  onTrackComplete,
  onNextTrack,
  onPreviousTrack 
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
  
  // Audio player hooks
  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);
  
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
      
      // Cancel any ongoing restoration by clearing the restoration track ID
      if (isRestorationInProgress) {
        console.log('🚫 Cancelling ongoing restoration for track switch');
        setRestorationTrackId(null);
      }
      
      setPlayerState('LOADING');
      setLoadedTrackId(null);
      setPlayerPosition(0);
      setDisplayPosition(0);
      setExpectedPosition(0);
      setRestorationProtection(false);
      setIsSeekInProgress(false);
      setIsRestorationInProgress(false);
      setRestorationTrackId(null);
      loadTrack(track);
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
    }
  }, [track]);
  
  // Handle audio loading and restoration
  useEffect(() => {
    if (!status || !track) return;
    
    console.log(`📊 Status: ${playerState}, isLoaded: ${status.isLoaded}, duration: ${status.duration}, currentTime: ${status.currentTime}`);
    
    // State machine transitions - prevent duplicate loading for same track
    if (playerState === 'LOADING' && status.isLoaded && status.duration > 0 && loadedTrackId !== track.id) {
      console.log(`✅ Audio loaded: ${track.title} (${track.id}) - Duration: ${status.duration}s`);
      setLoadedTrackId(track.id);
      
      // Wait a bit longer before transitioning to READY for subsequent tracks  
      const isFirstLoad = loadedTrackId === null;
      const delay = isFirstLoad ? 100 : 800; // Longer delay for subsequent tracks
      
      const timeout = setTimeout(() => {
        console.log(`✅ Audio stabilized - transitioning to READY (delay: ${delay}ms)`);
        setPlayerState('READY');
      }, delay);
      
      // Track timeout for cleanup
      setPendingTimeouts(prev => [...prev, timeout]);
    }
    
    // Automatic restoration when ready (prevent concurrent attempts)
    if (playerState === 'READY' && loadedTrackId === track.id && !isRestorationInProgress) {
      console.log(`🎯 Auto-restoring position for: ${track.title}`);
      restoreSavedPosition();
    }
  }, [status, track, playerState, loadedTrackId]);
  
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
      setPlayerPosition(status.currentTime);
      setDisplayPosition(status.currentTime);
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
          return localPath;
        }
      }
      
      // Get stream URL from backend
      console.log(`🌐 Getting stream URL for: ${track.title}`);
      const response = await retreatService.getTrackStreamUrl(track.id);
      
      if (response.success && response.url) {
        console.log(`✅ Got stream URL for: ${track.title}`);
        return response.url;
      } else {
        throw new Error(response.error || 'Failed to get stream URL');
      }
    } catch (error) {
      console.error('Error getting audio source:', error);
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
      setIsRestorationInProgress(true);
      setRestorationTrackId(currentTrackId);
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
          
          // Wait for audio to stabilize
          console.log('⏳ Waiting for audio to stabilize...');
          await new Promise(resolve => setTimeout(resolve, 600));
          
          // Check again if track changed during wait
          if (!track || track.id !== currentTrackId) {
            console.log(`⚠️ Track changed during stabilization wait (session: ${restorationSessionId}), aborting`);
            return;
          }
          
          // Validate player is still valid before seeking - check multiple conditions
          console.log(`🔍 Player validation (session: ${restorationSessionId}): player=${!!player}, status.isLoaded=${status?.isLoaded}, playerState=${playerState}, status.currentTime=${status?.currentTime}`);
          
          const isPlayerValid = player && 
                               status?.isLoaded && 
                               playerState !== 'LOADING';
                               
          if (!isPlayerValid) {
            console.log(`⚠️ Player became invalid during restoration (session: ${restorationSessionId}), aborting`);
            return;
          }
          
          // Double-check player object validity with try-catch
          try {
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
              if (track && track.id === currentTrackId) {
                setPlayerPosition(positionSeconds);
                setRestorationProtection(true);
                console.log(`✅ Position restoration completed: ${positionSeconds}s (session: ${restorationSessionId})`);
              } else {
                console.log(`⚠️ Track changed after seek, position not applied (session: ${restorationSessionId})`);
              }
            } catch (seekOperationError) {
              console.error(`❌ Seek operation failed (session: ${restorationSessionId}):`, seekOperationError);
              // Reset display position to match reality (0s)
              setDisplayPosition(0);
              setPlayerPosition(0);
              setExpectedPosition(0);
              setRestorationProtection(false);
              return;
            }
          } catch (seekError) {
            console.error(`❌ Player seek failed during restoration (session: ${restorationSessionId}):`, seekError);
            // Only reset if we're still on the same track
            if (track && track.id === currentTrackId) {
              setDisplayPosition(0);
              setPlayerPosition(0);
              setExpectedPosition(0);
              setRestorationProtection(false);
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
      console.error('❌ Error during position restoration:', error);
      // Only reset if we're still on the same track
      if (track && track.id === currentTrackId) {
        setRestorationProtection(false);
        setDisplayPosition(0);
        setPlayerPosition(0);
        setExpectedPosition(0);
      }
    } finally {
      // Always clean up flags (since we use local currentTrackId for validation)
      setIsSeekInProgress(false);
      setIsRestorationInProgress(false);
      
      // Only update player state if we're still on the same track
      if (track && track.id === currentTrackId) {
        setPlayerState('RESTORED');
        console.log(`🎯 Position restoration complete (session: ${restorationSessionId}) - seekInProgress: false`);
      } else {
        console.log(`🔄 Restoration cleanup - track changed during restoration (session: ${restorationSessionId})`);
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
    if (!player || !status?.isLoaded || playerState === 'LOADING') return;
    
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
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const newSpeed = speeds[(currentIndex + 1) % speeds.length];
    
    setPlaybackSpeed(newSpeed);
    if (player) {
      player.setPlaybackRate(newSpeed, 'medium');
    }
  };
  
  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Don't render if no track
  if (!track) {
    return null;
  }
  
  // Use display position for all UI elements
  const duration = status?.duration || track.duration || 0;
  const isPlaying = status?.playing || false;
  const isLoading = playerState === 'LOADING';
  const isPlayButtonDisabled = isLoading || isSeekInProgress;
  
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
            <TouchableOpacity 
              onPress={onPreviousTrack}
              style={[styles.controlButton, !onPreviousTrack && styles.controlDisabled]}
              disabled={!onPreviousTrack}
            >
              <Ionicons name="play-skip-back" size={22} color={onPreviousTrack ? colors.gray[700] : colors.gray[400]} />
            </TouchableOpacity>
            
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
            
            <TouchableOpacity 
              onPress={onNextTrack}
              style={[styles.controlButton, !onNextTrack && styles.controlDisabled]}
              disabled={!onNextTrack}
            >
              <Ionicons name="play-skip-forward" size={22} color={onNextTrack ? colors.gray[700] : colors.gray[400]} />
            </TouchableOpacity>
          </View>
          
          {/* Speed control positioned to the right */}
          <TouchableOpacity onPress={changePlaybackSpeed} style={styles.speedButton}>
            <Text style={styles.speedText}>{playbackSpeed}x</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
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
  speedButton: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  speedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
});