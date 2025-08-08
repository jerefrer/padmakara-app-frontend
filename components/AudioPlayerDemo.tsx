import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
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

interface AudioPlayerDemoProps {
  track: Track;
  onProgressUpdate?: (progress: UserProgress) => void;
  onTrackComplete?: () => void;
  onNextTrack?: () => void;
  onPreviousTrack?: () => void;
}

export function AudioPlayerDemo({ 
  track, 
  onProgressUpdate, 
  onTrackComplete,
  onNextTrack,
  onPreviousTrack 
}: AudioPlayerDemoProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(track.duration * 1000); // Convert to milliseconds
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isSliding, setIsSliding] = useState(false);
  
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressKey = `progress_${track.id}`;

  // Load saved progress
  useEffect(() => {
    loadSavedProgress();
    setDuration(track.duration * 1000);
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [track.id]);

  // Simulate audio progress when playing
  useEffect(() => {
    if (isPlaying && !isSliding) {
      progressIntervalRef.current = setInterval(() => {
        setPosition(prev => {
          const newPosition = prev + (1000 * playbackSpeed); // 1 second * speed
          
          // Check if track completed
          if (newPosition >= duration) {
            setIsPlaying(false);
            saveProgress(duration);
            onTrackComplete?.();
            return duration;
          }
          
          // Save progress every 10 seconds
          if (Math.floor(newPosition / 1000) % 10 === 0) {
            saveProgress(newPosition);
          }
          
          return newPosition;
        });
      }, 1000);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, isSliding, playbackSpeed, duration]);

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

  const togglePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      saveProgress(position);
    } else {
      setIsPlaying(true);
    }
  };

  const seekTo = async (value: number) => {
    try {
      setPosition(value);
      await saveProgress(value);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  const changePlaybackSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 0.75];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const newSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(newSpeed);
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
      {/* Demo Notice */}
      <View style={styles.demoNotice}>
        <Text style={styles.demoText}>
          📍 Demo Mode - Progress tracking works, but audio playback is simulated
        </Text>
      </View>

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
  demoNotice: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.saffron[500],
  },
  demoText: {
    fontSize: 14,
    color: colors.gray[700],
    textAlign: 'center',
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