import { RotateLeftThinIcon } from '@/components/icons/RotateLeftThinIcon';
import { RotateRightThinIcon } from '@/components/icons/RotateRightThinIcon';
import { SKIP_INTERVAL_S, useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { BAR_TOP_SHADOW } from '@/constants/barShadow';
import { useTabBarOverlap } from '@/hooks/useTabBarHeight';
import { getTrackTitle } from '@/utils/i18n';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

/** Thickness of the Android progress bar: iOS's thumbless slider is about 4 pt. */
const ANDROID_TRACK_HEIGHT = 4;
/** Horizontal padding Android's SeekBar keeps on each side for its thumb. */
const ANDROID_SEEKBAR_INSET = 16;

type ScrubListener = (value: number | null) => void;

/** A time label that shows the finger's position while scrubbing, else `position`. */
function ScrubTime({
  position,
  duration,
  subscribe,
  remaining = false,
  testID,
}: {
  position: number;
  duration: number;
  subscribe: (listener: ScrubListener) => () => void;
  remaining?: boolean;
  testID?: string;
}) {
  const [scrub, setScrub] = useState<number | null>(null);
  useEffect(() => subscribe(setScrub), [subscribe]);
  const time = scrub ?? position;
  return (
    <Text style={styles.timeText} testID={testID}>
      {remaining ? formatTimeRemaining(time, duration) : formatTime(time)}
    </Text>
  );
}

/** How often the time labels follow the finger while scrubbing on Android. */
const SCRUB_REPORT_MS = 100;

/** Fraction of the track at `position`, clamped to 0..1. */
const progressOf = (position: number, duration: number) =>
  duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

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
   * Override the bottom positioning. By default the player sits just above the
   * tab bar (see useTabBarOverlap); pass an explicit value when
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
  const { t, language } = useLanguage();
  const tabBarOverlap = useTabBarOverlap();
  const bottomOffset = bottom ?? tabBarOverlap;

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

  // True only while a finger is down on the progress bar. Drives the thumb's
  // visibility — see the Slider below.
  const [isSeeking, setIsSeeking] = useState(false);
  // Android draws its own bar (see below). While the finger is down the bar follows the
  // slider through a shared value, which moves it without re-rendering React, and the time
  // labels follow a local value refreshed at most every SCRUB_REPORT_MS. The audio context
  // only hears about the release (onSlidingComplete): its updates re-render the whole event
  // screen, which blocked JS and made the bar move in ~3 steps a second.
  const fillProgress = useSharedValue(0);
  // Time labels subscribe to the finger instead of reading parent state, so a label update
  // re-renders the two labels only, not the whole player and its native slider.
  const scrubListeners = useRef(new Set<ScrubListener>()).current;
  const subscribeScrub = useCallback((listener: ScrubListener) => {
    scrubListeners.add(listener);
    return () => {
      scrubListeners.delete(listener);
    };
  }, [scrubListeners]);
  const emitScrub = (value: number | null) => scrubListeners.forEach((listener) => listener(value));
  const scrubbingRef = useRef(false);
  const lastScrubReportRef = useRef(0);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fillProgress.value * 100}%` }));
  const thumbStyle = useAnimatedStyle(() => ({ left: `${fillProgress.value * 100}%` }));
  useEffect(() => {
    if (!scrubbingRef.current) fillProgress.value = progressOf(position, duration);
  }, [position, duration, fillProgress]);

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
          user expects it before audio is even buffered.

          The thumb is drawn only while the user is scrubbing; at rest the bar
          reads as a plain progress line. Hiding it is purely a tint change,
          so the full-width touch target is unaffected. On iOS 26 the patched
          slider (patches/@react-native-community+slider*.patch) turns the
          transparent tint into the system's thumbless style, and while
          scrubbing the thumb comes back untinted: the see-through glass dot
          the designer chose. */}
      <View style={styles.progressContainer}>
        {/* Android's SeekBar draws a 2 dp track inset by its thumb's width and offers no
            way to change either, so there the bar is drawn here, edge to edge and as thick
            as iOS's thumbless slider, with the SeekBar laid invisibly over it for touch. */}
        {Platform.OS === 'android' && (
          <View style={styles.androidTrack} pointerEvents="none" testID="audio-progress-track">
            <Reanimated.View style={[styles.androidFill, fillStyle]} testID="audio-progress-fill" />
            {isSeeking && <Reanimated.View style={[styles.androidThumb, thumbStyle]} />}
          </View>
        )}
        <Slider
          style={Platform.OS === 'android' ? styles.androidSlider : styles.progressBar}
          minimumValue={0}
          maximumValue={Math.max(duration, 1)}
          value={position}
          onSlidingStart={() => {
            scrubbingRef.current = true;
            setIsSeeking(true);
            onSlidingStart();
          }}
          onSlidingComplete={(value) => {
            scrubbingRef.current = false;
            setIsSeeking(false);
            if (Platform.OS === 'android') {
              fillProgress.value = progressOf(value, duration);
              // The context never heard the finger (see above): give it the released value
              // first, or it shows the pre-scrub time until the seek lands.
              onSliderValueChange(value);
            }
            emitScrub(null);
            onSlidingComplete(value);
          }}
          onValueChange={(value) => {
            if (Platform.OS !== 'android') {
              onSliderValueChange(value);
              return;
            }
            fillProgress.value = progressOf(value, duration);
            const now = Date.now();
            if (now - lastScrubReportRef.current >= SCRUB_REPORT_MS) {
              lastScrubReportRef.current = now;
              emitScrub(value);
            }
          }}
          minimumTrackTintColor={Platform.OS === 'android' ? 'transparent' : colors.burgundy[500]}
          maximumTrackTintColor={Platform.OS === 'android' ? 'transparent' : colors.gray[200]}
          thumbTintColor={Platform.OS === 'ios' && isSeeking ? undefined : 'transparent'}
          testID="audio-seek"
        />
      </View>

      {/* Transport row: time | controls | time */}
      <View style={styles.transportRow}>
        <ScrubTime position={position} duration={duration} subscribe={subscribeScrub} testID="audio-current-time" />

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
            <Text style={styles.skipNumber}>{SKIP_INTERVAL_S}</Text>
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
            <Text style={styles.skipNumber}>{SKIP_INTERVAL_S}</Text>
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

        <ScrubTime position={position} duration={duration} subscribe={subscribeScrub} remaining />
      </View>

      {/* Track info */}
      <Text style={styles.trackTitle} numberOfLines={1}>
        {getTrackTitle(currentTrack, language)}
      </Text>

      {/* Bottom toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolbarButton, !onBookmarkPress && styles.toolbarButtonDisabled]}
          onPress={onBookmarkPress}
          disabled={!onBookmarkPress}
          testID="audio-bookmark"
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
    ...BAR_TOP_SHADOW,
  },
  progressContainer: {
    height: 6,
  },
  progressBar: {
    height: 6,
    marginHorizontal: -2,
  },
  androidTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ANDROID_TRACK_HEIGHT,
    backgroundColor: colors.gray[200],
  },
  androidFill: {
    height: '100%',
    backgroundColor: colors.burgundy[500],
  },
  androidThumb: {
    position: 'absolute',
    top: ANDROID_TRACK_HEIGHT / 2 - 7,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: colors.burgundy[500],
  },
  // Wider than the screen by the SeekBar's inner padding on each side, so its
  // value maps to the finger's position on the edge-to-edge bar drawn above.
  androidSlider: {
    height: 24,
    marginTop: -9,
    marginHorizontal: -ANDROID_SEEKBAR_INSET,
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
