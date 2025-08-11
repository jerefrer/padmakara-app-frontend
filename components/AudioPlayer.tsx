import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track, UserProgress } from '@/types';
import { BookmarksManager } from './BookmarksManager';
import retreatService from '@/services/retreatService';
import i18n from '@/utils/i18n';

const colors = {
  cream: {
    100: '#fcf8f3',
  },
  burgundy: {
    500: '#b91c1c',
    600: '#991b1b',
  },
  saffron: {
    500: '#f59e0b',
  },
  gray: {
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

interface AudioPlayerProps {
  track: Track;
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
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isSliding, setIsSliding] = useState(false);
  const [localPlayingState, setLocalPlayingState] = useState(false); // Fallback state
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Use the expo-audio hooks
  const player = useAudioPlayer(audioSource, 1000); // 1000ms update interval
  const status = useAudioPlayerStatus(player);
  
  const progressKey = `progress_${track.id}`;

  // Setup audio session
  useEffect(() => {
    setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  // Load saved progress and audio source
  useEffect(() => {
    loadSavedProgress();
    loadAudioSource();
  }, [track.id]);

  // Listen to status updates
  useEffect(() => {
    console.log('🎵 Audio status update:', {
      isPlaying: status?.isPlaying,
      currentTime: status?.currentTime,
      duration: status?.duration,
      muted: status?.muted,
      error: status?.error,
      audioSource: audioSource,
      hasStatus: !!status,
      isLoaded: status?.isLoaded,
      isBuffering: status?.isBuffering,
      playbackState: status?.playbackState,
      timeControlStatus: status?.timeControlStatus,
      reasonForWaitingToPlay: status?.reasonForWaitingToPlay
    });
    
    if (status) {
      // Check for loading errors or failures
      if (status.error) {
        console.error('🎵 Audio player error:', status.error);
        Alert.alert('Playback Error', `Audio error: ${status.error}`);
      }
      
      // Detect if audio is stuck in buffering/loading state
      if (audioSource && !status.isLoaded && status.isBuffering) {
        console.warn('🎵 Audio is stuck in buffering state. This might indicate a URL or format issue.');
      }
      
      // Log when audio successfully loads
      if (status.isLoaded && status.duration > 0) {
        console.log('✅ Audio successfully loaded!', {
          duration: status.duration,
          playbackState: status.playbackState
        });
        
        // Clear loading timeout since audio loaded successfully
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
          setLoadingTimeout(null);
        }
      }
      
      // Sync local playing state with actual status
      if (status.isPlaying !== undefined) {
        setLocalPlayingState(status.isPlaying);
      }
      
      if (!isSliding) {
        setPosition(status.currentTime * 1000); // Convert to milliseconds
        
        // Save progress every 10 seconds
        const currentTimeMs = status.currentTime * 1000;
        if (currentTimeMs && currentTimeMs % 10000 < 1000) {
          saveProgress(currentTimeMs);
        }
        
        // Check if track completed
        if (status.didJustFinish || (status.currentTime >= status.duration && status.duration > 0)) {
          saveProgress(status.duration * 1000);
          onTrackComplete?.();
        }
      }
    }
  }, [status, isSliding]);

  const loadSavedProgress = async () => {
    try {
      const savedProgress = await AsyncStorage.getItem(progressKey);
      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        setPosition(progress.position * 1000); // Convert to milliseconds
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const saveProgress = async (currentPosition: number) => {
    try {
      const progress: UserProgress = {
        trackId: track.id,
        position: Math.floor(currentPosition / 1000), // Convert to seconds
        completed: currentPosition >= duration * 0.95, // Mark completed if 95% played
        lastPlayed: new Date().toISOString(),
        bookmarks: [], // Will implement bookmarks later
      };
      
      await AsyncStorage.setItem(progressKey, JSON.stringify(progress));
      onProgressUpdate?.(progress);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const loadAudioSource = async () => {
    try {
      setIsLoading(true);
      
      let source = null;
      
      // Check if track is downloaded locally first
      const isDownloaded = await retreatService.isTrackDownloaded(track.id);
      
      if (isDownloaded) {
        const localPath = await retreatService.getDownloadedTrackPath(track.id);
        if (localPath) {
          console.log(`🎵 Playing offline audio: ${localPath}`);
          source = localPath;
        }
      }
      
      // If not available locally, stream from backend
      if (!source) {
        console.log(`🔍 Fetching stream URL for track ${track.id}...`);
        const urlResponse = await retreatService.getTrackStreamUrl(track.id);
        
        console.log(`🔍 URL Response:`, urlResponse);
        
        if (!urlResponse.success || !urlResponse.url) {
          console.error(`❌ Failed to get URL:`, urlResponse);
          throw new Error(urlResponse.error || 'Failed to get audio URL');
        }
        
        // URL received from backend - presigned URLs are pre-validated
        console.log(`✅ Using presigned stream URL: ${urlResponse.url.substring(0, 80)}...`);
        console.log(`🔍 [AUDIO DEBUG] Presigned URL contains signature: ${urlResponse.url.includes('Signature=')}`);
        console.log(`🔍 [AUDIO DEBUG] Presigned URL contains expiration: ${urlResponse.url.includes('Expires=')}`);
        source = urlResponse.url;
      }
      
      setAudioSource(source);
      
      // Set up a timeout to detect if audio loading fails
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      
      const timeout = setTimeout(() => {
        if (status && !status.isLoaded && status.isBuffering) {
          console.error('🎵 Audio loading timeout - failed to load after 15 seconds');
          Alert.alert(
            'Loading Error',
            'Audio is taking too long to load. This might be due to network issues or server problems.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: () => loadAudioSource() }
            ]
          );
        }
      }, 15000); // 15 second timeout
      
      setLoadingTimeout(timeout);
      
      // Seek to saved position after a delay to allow the player to initialize
      if (position > 0) {
        setTimeout(() => {
          try {
            player.seekTo(position / 1000); // Convert to seconds
          } catch (seekError) {
            console.warn('Could not seek to saved position:', seekError);
          }
        }, 1000);
      }
      
    } catch (error) {
      console.error('Error loading audio source:', error);
      
      // Provide specific error messages based on the error
      let errorMessage = 'Could not load audio file. Please check your connection and try again.';
      if (error.message.includes('Access denied')) {
        errorMessage = 'Access denied to audio file. This might be a server configuration issue.';
      } else if (error.message.includes('not accessible')) {
        errorMessage = 'Audio file is not accessible. The server might be experiencing issues.';
      }
      
      Alert.alert('Audio Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };


  const togglePlayPause = async () => {
    try {
      const currentlyPlaying = status?.isPlaying || localPlayingState;
      console.log(`🎵 Toggle play/pause - Status playing: ${status?.isPlaying}, Local playing: ${localPlayingState}, Combined: ${currentlyPlaying}, Source: ${audioSource ? 'loaded' : 'not loaded'}`);
      console.log(`🎵 Player object exists: ${!!player}, Status object:`, status);
      
      if (!audioSource) {
        console.log(`🎵 No audio source loaded, loading...`);
        await loadAudioSource();
        return;
      }

      // Check if audio is loaded before trying to play
      if (!status?.isLoaded) {
        console.warn(`🎵 Audio not loaded yet. Status:`, {
          isLoaded: status?.isLoaded,
          isBuffering: status?.isBuffering,
          playbackState: status?.playbackState,
          error: status?.error
        });
        
        Alert.alert(
          'Audio Not Ready',
          'Audio is still loading. Please wait a moment and try again.',
          [
            { text: 'OK' },
            { text: 'Retry Loading', onPress: () => loadAudioSource() }
          ]
        );
        return;
      }

      if (currentlyPlaying) {
        console.log(`⏸️ Pausing audio...`);
        try {
          player.pause();
          setLocalPlayingState(false);
          console.log(`✅ Pause command sent`);
        } catch (pauseError) {
          console.error('❌ Error calling pause:', pauseError);
        }
      } else {
        console.log(`▶️ Playing audio...`);
        try {
          player.play();
          setLocalPlayingState(true);
          console.log(`✅ Play command sent`);
        } catch (playError) {
          console.error('❌ Error calling play:', playError);
          Alert.alert('Playback Error', `Failed to start playback: ${playError.message}`);
        }
      }
    } catch (error) {
      console.error('Error in togglePlayPause:', error);
      Alert.alert(
        'Playback Error', 
        'Could not play audio. Please check your connection and try again.'
      );
    }
  };

  const seekTo = async (value: number) => {
    try {
      if (audioSource && player) {
        player.seekTo(value / 1000); // Convert to seconds
        setPosition(value);
        await saveProgress(value);
      }
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  const changePlaybackSpeed = async () => {
    const speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 0.75];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const newSpeed = speeds[(currentIndex + 1) % speeds.length];
    
    setPlaybackSpeed(newSpeed);
    
    if (audioSource && player) {
      try {
        player.playbackRate = newSpeed;
      } catch (error) {
        console.error('Error changing playback speed:', error);
      }
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const duration = (status?.duration || track.duration) * 1000; // Convert to milliseconds
  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;
  const isCurrentlyPlaying = status?.isPlaying || localPlayingState;

  return (
    <View style={styles.container}>
      {/* Track Info */}
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={2}>
          {track.title}
        </Text>
        <Text style={styles.progressText}>
          {formatTime(position)} / {formatTime(duration)} ({progressPercentage.toFixed(1)}%)
        </Text>
      </View>

      {/* Progress Slider */}
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration}
          value={position}
          onValueChange={(value) => {
            setIsSliding(true);
            setPosition(value);
          }}
          onSlidingComplete={(value) => {
            setIsSliding(false);
            seekTo(value);
          }}
          minimumTrackTintColor={colors.burgundy[500]}
          maximumTrackTintColor={colors.gray[400]}
          thumbStyle={styles.sliderThumb}
        />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity 
          onPress={onPreviousTrack}
          style={styles.controlButton}
          disabled={!onPreviousTrack}
        >
          <Ionicons 
            name="play-skip-back" 
            size={24} 
            color={onPreviousTrack ? colors.burgundy[500] : colors.gray[400]} 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={togglePlayPause}
          style={[styles.controlButton, styles.playButton]}
          disabled={isLoading}
        >
          <Ionicons 
            name={isCurrentlyPlaying ? "pause" : "play"} 
            size={32} 
            color="white" 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={onNextTrack}
          style={styles.controlButton}
          disabled={!onNextTrack}
        >
          <Ionicons 
            name="play-skip-forward" 
            size={24} 
            color={onNextTrack ? colors.burgundy[500] : colors.gray[400]} 
          />
        </TouchableOpacity>
      </View>

      {/* Speed Control & Bookmarks */}
      <View style={styles.bottomControls}>
        <TouchableOpacity onPress={changePlaybackSpeed} style={styles.speedButton}>
          <Text style={styles.speedText}>{playbackSpeed}x</Text>
        </TouchableOpacity>
        
        <BookmarksManager
          trackId={track.id}
          currentPosition={position}
          onSeekToBookmark={seekTo}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trackInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  trackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.burgundy[500],
    textAlign: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: colors.gray[600],
  },
  sliderContainer: {
    marginBottom: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderThumb: {
    backgroundColor: colors.burgundy[500],
    width: 20,
    height: 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  controlButton: {
    padding: 10,
    marginHorizontal: 15,
  },
  playButton: {
    backgroundColor: colors.burgundy[500],
    borderRadius: 30,
    padding: 15,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  speedButton: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  speedText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
});