import { RotateLeftThinIcon } from '@/components/icons/RotateLeftThinIcon';
import { RotateRightThinIcon } from '@/components/icons/RotateRightThinIcon';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const colors = {
  burgundy: {
    500: '#9b1b1b',
    600: '#7b1616',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#2c2c2c',
  },
  white: '#ffffff',
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTimeRemaining = (position: number, duration: number) => {
  const remaining = Math.max(duration - position, 0);
  return `- ${formatTime(remaining)}`;
};

interface AudioPlayerProps {
  /** Tap on the globe button — typically opens a language picker. */
  onLanguagePress?: () => void;
  /** Tap on the read button — typically opens read-along when available. */
  onReadPress?: () => void;
  /** Tap on the bookmark button — typically toggles a track-level bookmark. */
  onBookmarkPress?: () => void;
  /** Optional label shown next to the globe icon (e.g. "En + Pt"). */
  languageLabel?: string;
  /**
   * Override the bottom positioning. By default the player sits above the
   * tab bar (49px + safe-area inset on iOS); pass an explicit value when
   * mounting the player inside a modal that has no tab bar — typically
   * `insets.bottom` so it just clears the home indicator.
   */
  bottom?: number;
}

export function AudioPlayer({
  onLanguagePress,
  onReadPress,
  onBookmarkPress,
  languageLabel,
  bottom,
}: AudioPlayerProps = {}) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const TAB_BAR_HEIGHT = 49;
  const defaultBottom = Platform.OS === 'ios' ? TAB_BAR_HEIGHT + insets.bottom : TAB_BAR_HEIGHT;
  const bottomOffset = bottom ?? defaultBottom;

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
          maximumTrackTintColor={colors.gray[200]}
          thumbTintColor={colors.burgundy[500]}
        />
      </View>

      {/* Transport row: time | controls | time */}
      <View style={styles.transportRow}>
        <Text style={styles.timeText}>{formatTime(position)}</Text>

        <View style={styles.controls}>
          {/* Previous track */}
          <TouchableOpacity
            onPress={previousTrack}
            style={[styles.controlButton, !hasPreviousTrack && styles.controlDisabled]}
            disabled={!hasPreviousTrack}
          >
            <Ionicons name="play-skip-back" size={20} color={hasPreviousTrack ? colors.gray[700] : colors.gray[400]} />
          </TouchableOpacity>

          {/* -10s button */}
          <TouchableOpacity
            onPress={skipBackward}
            style={[styles.circularSkipButton, isPlayButtonDisabled && styles.controlDisabled]}
            disabled={isPlayButtonDisabled}
          >
            <RotateLeftThinIcon
              size={28}
              color={isPlayButtonDisabled ? colors.gray[400] : colors.gray[700]}
              strokeWidth={1.5}
            />
            <Text style={[styles.skipNumber, isPlayButtonDisabled && styles.skipNumberDisabled]}>10</Text>
          </TouchableOpacity>

          {/* Play/Pause button */}
          <TouchableOpacity
            onPress={togglePlayPause}
            style={[styles.playButton, isPlayButtonDisabled && styles.playButtonDisabled]}
            disabled={isPlayButtonDisabled}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              color={colors.gray[800]}
            />
          </TouchableOpacity>

          {/* +10s button */}
          <TouchableOpacity
            onPress={skipForward}
            style={[styles.circularSkipButton, isPlayButtonDisabled && styles.controlDisabled]}
            disabled={isPlayButtonDisabled}
          >
            <RotateRightThinIcon
              size={28}
              color={isPlayButtonDisabled ? colors.gray[400] : colors.gray[700]}
              strokeWidth={1.5}
            />
            <Text style={[styles.skipNumber, isPlayButtonDisabled && styles.skipNumberDisabled]}>10</Text>
          </TouchableOpacity>

          {/* Next track */}
          <TouchableOpacity
            onPress={nextTrack}
            style={[styles.controlButton, !hasNextTrack && styles.controlDisabled]}
            disabled={!hasNextTrack}
          >
            <Ionicons name="play-skip-forward" size={20} color={hasNextTrack ? colors.gray[700] : colors.gray[400]} />
          </TouchableOpacity>
        </View>

        <Text style={styles.timeText}>{formatTimeRemaining(position, duration)}</Text>
      </View>

      {/* Track info */}
      <Text style={styles.trackTitle} numberOfLines={1}>
        {currentTrack.title}
      </Text>

      {/* Bottom toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={onBookmarkPress}>
          <Ionicons name="bookmark-outline" size={20} color={colors.gray[600]} />
          <Text style={styles.toolbarLabel}>{t('player.bookmark') || 'bookmark'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={changePlaybackSpeed}
          style={styles.toolbarButton}
          disabled={isPlayButtonDisabled}
        >
          <Text style={[styles.speedValue, isPlayButtonDisabled && styles.toolbarLabelDisabled]}>x{playbackSpeed}</Text>
          <Text style={[styles.toolbarLabel, isPlayButtonDisabled && styles.toolbarLabelDisabled]}>
            {t('player.speed') || 'speed'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarButton} onPress={onReadPress}>
          <Ionicons name="document-text-outline" size={20} color={colors.gray[600]} />
          <Text style={styles.toolbarLabel}>{t('player.read') || 'read'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarButton} onPress={onLanguagePress}>
          <Ionicons name="globe-outline" size={20} color={colors.gray[600]} />
          <Text style={styles.toolbarLabel}>{languageLabel || t('player.language') || 'En + Pt'}</Text>
        </TouchableOpacity>
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
    borderTopColor: colors.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
  progressContainer: {
    height: 6,
  },
  progressBar: {
    height: 6,
    marginHorizontal: -2,
  },

  // Transport row: time – controls – time
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.burgundy[500],
    minWidth: 52,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  controlButton: {
    padding: 8,
  },
  controlDisabled: {
    opacity: 0.4,
  },
  playButton: {
    padding: 6,
    marginHorizontal: 4,
  },
  playButtonDisabled: {
    opacity: 0.4,
  },
  circularSkipButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipNumber: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.gray[700],
    textAlign: 'center',
    position: 'absolute',
  },
  skipNumberDisabled: {
    color: colors.gray[400],
  },

  // Track info
  trackTitle: {
    fontSize: 13,
    color: colors.gray[500],
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },

  // Bottom toolbar
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  toolbarButton: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  toolbarLabel: {
    fontSize: 10,
    color: colors.gray[500],
    marginTop: 2,
  },
  toolbarLabelDisabled: {
    opacity: 0.4,
  },
  speedValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray[700],
  },

  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
