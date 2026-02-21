import { RotateLeftThinIcon } from '@/components/icons/RotateLeftThinIcon';
import { RotateRightThinIcon } from '@/components/icons/RotateRightThinIcon';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const colors = {
  burgundy: {
    500: '#b91c1c',
    600: '#991b1b',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
  },
  white: '#ffffff',
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function AudioPlayer() {
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 49;
  const bottomOffset = Platform.OS === 'ios' ? TAB_BAR_HEIGHT + insets.bottom : TAB_BAR_HEIGHT;

  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    playbackSpeed,
    isLoading,
    isPlayButtonDisabled,
    togglePlayPause,
    skipForward,
    skipBackward,
    nextTrack,
    previousTrack,
    hasNextTrack,
    hasPreviousTrack,
    changePlaybackSpeed,
    onSlidingStart,
    onSlidingComplete,
    onSliderValueChange,
  } = useAudioPlayerContext();

  if (!currentTrack) {
    return null;
  }

  return (
    <View style={[styles.container, { bottom: bottomOffset }]}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <Slider
          style={styles.progressBar}
          minimumValue={0}
          maximumValue={Math.max(duration, 1)}
          value={position}
          onSlidingStart={onSlidingStart}
          onSlidingComplete={onSlidingComplete}
          onValueChange={onSliderValueChange}
          minimumTrackTintColor={colors.burgundy[500]}
          maximumTrackTintColor={colors.gray[400]}
          thumbStyle={styles.progressThumb}
        />
      </View>

      {/* Player content */}
      <View style={styles.playerContent}>
        {/* Track info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={2}>
            {currentTrack.title}
          </Text>
          <Text style={styles.trackTime}>
            {formatTime(position)} / {formatTime(duration)}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          <View style={styles.controls}>
            {/* Previous track */}
            <TouchableOpacity
              onPress={previousTrack}
              style={[styles.controlButton, !hasPreviousTrack && styles.controlDisabled]}
              disabled={!hasPreviousTrack}
            >
              <Ionicons name="play-skip-back" size={22} color={hasPreviousTrack ? colors.gray[700] : colors.gray[400]} />
            </TouchableOpacity>

            {/* -15s button */}
            <TouchableOpacity
              onPress={skipBackward}
              style={[styles.circularSkipButton, isPlayButtonDisabled && styles.controlDisabled]}
              disabled={isPlayButtonDisabled}
            >
              <RotateLeftThinIcon
                size={32}
                color={isPlayButtonDisabled ? colors.gray[400] : colors.gray[700]}
                strokeWidth={1.5}
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
              <RotateRightThinIcon
                size={32}
                color={isPlayButtonDisabled ? colors.gray[400] : colors.gray[700]}
                strokeWidth={1.5}
              />
              <Text style={[styles.skipNumber, isPlayButtonDisabled && styles.skipNumberDisabled]}>15</Text>
            </TouchableOpacity>

            {/* Next track */}
            <TouchableOpacity
              onPress={nextTrack}
              style={[styles.controlButton, !hasNextTrack && styles.controlDisabled]}
              disabled={!hasNextTrack}
            >
              <Ionicons name="play-skip-forward" size={22} color={hasNextTrack ? colors.gray[700] : colors.gray[400]} />
            </TouchableOpacity>
          </View>

          {/* Speed control */}
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
      {isLoading && (
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
    paddingTop: 16,
    paddingBottom: 24,
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
  skipNumber: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.gray[700],
    textAlign: 'center',
    position: 'absolute',
  },
  skipNumberDisabled: {
    color: colors.gray[400],
  },
  speedButton: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -14 }],
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
    paddingBottom: 28,
    paddingLeft: 16,
    zIndex: 1000,
  },
});
