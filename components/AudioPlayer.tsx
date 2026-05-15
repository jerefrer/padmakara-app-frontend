import { RotateLeftThinIcon } from '@/components/icons/RotateLeftThinIcon';
import { RotateRightThinIcon } from '@/components/icons/RotateRightThinIcon';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  /** Whether the current track is bookmarked. Drives the icon (filled vs outlined). */
  isBookmarked?: boolean;
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

/**
 * Optimistic audio player UI:
 *   - Slider, play, skip, and speed are always interactive while a track
 *     is loaded. Tapping play during the loading phase is acknowledged
 *     immediately (icon flips, playback starts as soon as audio is ready).
 *   - The only loading affordance is a thin spinning ring around the play
 *     button, and it only appears if loading takes longer than a quick
 *     beat — so the typical fast cache hit shows no spinner at all.
 */
export function AudioPlayer({
  onLanguagePress,
  onReadPress,
  onBookmarkPress,
  isBookmarked = false,
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

  // Show a thin progress ring around the play button only when loading
  // exceeds 300ms — fast cache hits never paint a spinner, while slower
  // network loads still get visible feedback.
  const [showLoadingRing, setShowLoadingRing] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setShowLoadingRing(false);
      return;
    }
    const t = setTimeout(() => setShowLoadingRing(true), 300);
    return () => clearTimeout(t);
  }, [isLoading]);

  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!showLoadingRing) {
      spinAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [showLoadingRing, spinAnim]);

  const ringRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!currentTrack) {
    return null;
  }

  return (
    <View style={[styles.container, { bottom: bottomOffset }]}>
      {/* Progress bar — always interactive. While loading, position
          reflects the saved/seek-to target so the thumb sits where the
          user expects it before audio is even buffered. */}
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
          testID="audio-seek"
        />
      </View>

      {/* Transport row: time | controls | time */}
      <View style={styles.transportRow}>
        <Text style={styles.timeText} testID="audio-current-time">{formatTime(position)}</Text>

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
          <TouchableOpacity onPress={skipBackward} style={styles.circularSkipButton} testID="audio-skip-back">
            <RotateLeftThinIcon size={28} color={colors.gray[700]} strokeWidth={1.5} />
            <Text style={styles.skipNumber}>10</Text>
          </TouchableOpacity>

          {/* Play/Pause button — wrapped so we can overlay a thin loading
              ring without offsetting the icon. */}
          <View style={styles.playButtonWrapper}>
            {showLoadingRing && (
              <Animated.View
                pointerEvents="none"
                style={[styles.loadingRing, { transform: [{ rotate: ringRotation }] }]}
              />
            )}
            <TouchableOpacity onPress={togglePlayPause} style={styles.playButton} testID="audio-play-pause">
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={28}
                color={colors.gray[800]}
              />
            </TouchableOpacity>
          </View>

          {/* +10s button */}
          <TouchableOpacity onPress={skipForward} style={styles.circularSkipButton} testID="audio-skip-forward">
            <RotateRightThinIcon size={28} color={colors.gray[700]} strokeWidth={1.5} />
            <Text style={styles.skipNumber}>10</Text>
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
        <TouchableOpacity
          style={[styles.toolbarButton, !onBookmarkPress && styles.toolbarButtonDisabled]}
          onPress={onBookmarkPress}
          disabled={!onBookmarkPress}
        >
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={isBookmarked ? colors.burgundy[500] : colors.gray[600]}
          />
          <Text
            style={[
              styles.toolbarLabel,
              isBookmarked && { color: colors.burgundy[500] },
            ]}
          >
            {t('player.bookmark') || 'bookmark'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarButton} onPress={changePlaybackSpeed}>
          <Text style={styles.speedValue}>x{playbackSpeed}</Text>
          <Text style={styles.toolbarLabel}>{t('player.speed') || 'speed'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolbarButton, !onReadPress && styles.toolbarButtonDisabled]}
          onPress={onReadPress}
          disabled={!onReadPress}
        >
          <Ionicons name="document-text-outline" size={20} color={colors.gray[600]} />
          <Text style={styles.toolbarLabel}>{t('player.read') || 'Read Along'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarButton} onPress={onLanguagePress}>
          <Ionicons name="globe-outline" size={20} color={colors.gray[600]} />
          <Text style={styles.toolbarLabel}>{languageLabel || t('player.language') || 'En + Pt'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const PLAY_BUTTON_SIZE = 44;
const RING_SIZE = PLAY_BUTTON_SIZE + 8;

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
  playButtonWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  playButton: {
    width: PLAY_BUTTON_SIZE,
    height: PLAY_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: colors.burgundy[500],
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
  toolbarButtonDisabled: {
    opacity: 0.4,
  },
  toolbarLabel: {
    fontSize: 10,
    color: colors.gray[500],
    marginTop: 2,
  },
  speedValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray[700],
  },
});
