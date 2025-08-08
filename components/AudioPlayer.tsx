import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track, UserProgress } from '@/types';
import { BookmarksManager } from './BookmarksManager';
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
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(track.duration * 1000); // Convert to milliseconds
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isSliding, setIsSliding] = useState(false);
  
  const soundRef = useRef<Audio.Sound | null>(null);
  const progressKey = `progress_${track.id}`;

  // Load saved progress
  useEffect(() => {
    loadSavedProgress();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [track.id]);

  // Setup audio session
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

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

  const loadAudio = async () => {
    try {
      setIsLoading(true);
      
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        setSound(null);
        soundRef.current = null;
      }

      // For demo purposes, we'll use a working test audio file
      // In production, this would be your S3 URL or the actual file path
      let audioSource;
      
      try {
        // Try to use a local asset first (you'd need to add this to assets folder)
        audioSource = require('@/assets/audio/demo-track.mp3');
      } catch {
        // Fallback to a known working online audio file for demo
        audioSource = { 
          uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav'
        };
      }
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        audioSource,
        {
          shouldPlay: false,
          isLooping: false,
          rate: playbackSpeed,
          progressUpdateIntervalMillis: 1000,
        },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      soundRef.current = newSound;
      
      // Seek to saved position after a small delay to ensure the sound is fully loaded
      if (position > 0) {
        setTimeout(async () => {
          try {
            await newSound.setPositionAsync(position);
          } catch (seekError) {
            console.warn('Could not seek to saved position:', seekError);
          }
        }, 500);
      }
      
    } catch (error) {
      console.error('Error loading audio:', error);
      Alert.alert(
        'Audio Not Available', 
        'This is a demo version. In the production app, this would play your actual retreat recordings from AWS S3.\n\nFor now, you can explore the interface and see how progress tracking works.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      if (!isSliding) {
        setPosition(status.positionMillis || 0);
      }
      setDuration(status.durationMillis || track.duration * 1000);
      
      // Save progress every 10 seconds
      if (status.positionMillis && status.positionMillis % 10000 < 1000) {
        saveProgress(status.positionMillis);
      }
      
      // Check if track completed
      if (status.didJustFinish) {
        setIsPlaying(false);
        saveProgress(status.durationMillis || duration);
        onTrackComplete?.();
      }
    }
  };

  const togglePlayPause = async () => {
    try {
      if (!sound) {
        await loadAudio();
        return;
      }

      // Check if sound is actually loaded before trying to play/pause
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        console.warn('Sound not loaded, attempting to reload...');
        await loadAudio();
        return;
      }

      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      Alert.alert(
        'Playback Error', 
        'Could not play audio. This is normal in the demo version. The full app will play your actual retreat recordings.'
      );
    }
  };

  const seekTo = async (value: number) => {
    try {
      if (sound) {
        await sound.setPositionAsync(value);
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
    
    if (sound) {
      try {
        await sound.setRateAsync(newSpeed, true);
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

  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

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
            name={isPlaying ? "pause" : "play"} 
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