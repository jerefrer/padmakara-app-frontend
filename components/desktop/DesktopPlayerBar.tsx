import { PlayingIndicator } from '@/components/PlayingIndicator';
import { RotateLeftThinIcon } from '@/components/icons/RotateLeftThinIcon';
import { RotateRightThinIcon } from '@/components/icons/RotateRightThinIcon';
import { colors } from '@/constants/colors';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageCheckboxList } from '@/components/LanguageCheckboxList';
import { getTrackTitle } from '@/utils/i18n';
import { requestTrackReveal } from '@/utils/trackReveal';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
} from 'react-native';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/** Time left, as the phone player shows it to the right of its controls. */
const formatTimeRemaining = (position: number, duration: number) =>
  `- ${formatTime(Math.max(duration - position, 0))}`;

/** Fraction of the track at `position`, clamped to 0..1. */
const progressOf = (position: number, duration: number) =>
  duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

/** Thickness of the progress line drawn along the bar's top edge. */
export const PROGRESS_LINE_HEIGHT = 2;
/** Invisible band around the line that takes clicks and drags to seek. */
export const PROGRESS_HIT_HEIGHT = 16;

export function DesktopPlayerBar() {
  const { t, language } = useLanguage();
  const pathname = usePathname();
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    playbackSpeed,
    isLoading,
    isPlayButtonDisabled,
    hasNextTrack,
    hasPreviousTrack,
    togglePlayPause,
    skipForward,
    skipBackward,
    nextTrack,
    previousTrack,
    changePlaybackSpeed,
    onSlidingStart,
    onSlidingComplete,
    onSliderValueChange,
    retreatName,
    groupName,
    idleTrack,
    resumeLastPlayed,
    canOpenReadAlong,
    openReadAlong,
    trackBookmark,
    languageControl,
    retreatId,
  } = useAudioPlayerContext();

  const [languageOpen, setLanguageOpen] = useState(false);
  // The picker belongs to the event screen; close it when that control goes away.
  useEffect(() => {
    if (!languageControl) setLanguageOpen(false);
  }, [languageControl]);

  // True only while the user is scrubbing: the seek thumb is drawn then and
  // hidden at rest, same as the mobile player.
  const [isSeeking, setIsSeeking] = useState(false);
  // The progress line spans the whole bar; its width and page offset turn a pointer's x into a time.
  const [lineWidth, setLineWidth] = useState(0);
  const lineLeftRef = useRef(0);
  const lastSeekRef = useRef(0);

  const hasTrack = !!currentTrack;
  const hasIdleTrack = !hasTrack && !!idleTrack;

  // Display info: use active track, or fall back to idle track for display
  const displayTitle = hasTrack
    ? getTrackTitle(currentTrack, language)
    : hasIdleTrack
      ? getTrackTitle(idleTrack.track, language)
      : null;
  const displaySubtitle = hasTrack
    ? [groupName, retreatName].filter(Boolean).join(' \u00B7 ')
    : hasIdleTrack
      ? [idleTrack.meta?.groupName, idleTrack.meta?.retreatName].filter(Boolean).join(' \u00B7 ')
      : '';
  const displayPosition = hasTrack ? position : hasIdleTrack ? idleTrack.position : 0;
  const displayDuration = hasTrack ? duration : hasIdleTrack ? idleTrack.duration : 0;

  // All controls disabled when no track and no idle track
  const allDisabled = !hasTrack && !hasIdleTrack;
  // Only play button enabled for idle track (others need actual audio)
  const controlsDisabled = !hasTrack;

  // Thin progress ring around the play button — only paints when loading
  // exceeds 300ms so fast cache hits stay flicker-free.
  const [showLoadingRing, setShowLoadingRing] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setShowLoadingRing(false);
      return;
    }
    const tm = setTimeout(() => setShowLoadingRing(true), 300);
    return () => clearTimeout(tm);
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

  // Click or drag anywhere on the progress line to seek. The line's page offset is taken when
  // the press starts (the press lands on the hit band itself, so locationX is relative to it),
  // so a drag that leaves the band keeps mapping pageX correctly.
  const timeAtPageX = (pageX: number) =>
    lineWidth > 0
      ? Math.min(1, Math.max(0, (pageX - lineLeftRef.current) / lineWidth)) * displayDuration
      : 0;
  const onSeekGrant = (e: GestureResponderEvent) => {
    lineLeftRef.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
    lastSeekRef.current = timeAtPageX(e.nativeEvent.pageX);
    setIsSeeking(true);
    onSlidingStart();
    onSliderValueChange(lastSeekRef.current);
  };
  const onSeekMove = (e: GestureResponderEvent) => {
    lastSeekRef.current = timeAtPageX(e.nativeEvent.pageX);
    onSliderValueChange(lastSeekRef.current);
  };
  const onSeekEnd = () => {
    setIsSeeking(false);
    onSlidingComplete(lastSeekRef.current);
  };
  const progress = progressOf(displayPosition, displayDuration);

  // Tapping the title shows the track in its event's list, opening the event first when the
  // person is elsewhere (the event page itself opens at its top).
  const showTrackInEvent = () => {
    if (!currentTrack || !retreatId) return;
    requestTrackReveal(currentTrack.id);
    if (pathname === `/retreat/${retreatId}`) return;
    router.push({ pathname: '/(tabs)/(groups)/retreat/[id]', params: { id: retreatId } } as any);
  };

  return (
      <View style={styles.container}>

        {/* The bar's top edge is the track's progress line (André): red as the track plays,
            full width. A taller invisible band over it takes clicks and drags to seek. */}
        <View
          style={styles.progressHitArea}
          onLayout={(e) => setLineWidth(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => !controlsDisabled}
          onMoveShouldSetResponder={() => !controlsDisabled}
          onResponderTerminationRequest={() => false}
          onResponderGrant={onSeekGrant}
          onResponderMove={onSeekMove}
          onResponderRelease={onSeekEnd}
          onResponderTerminate={onSeekEnd}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('player.seek') || 'Playback position'}
          accessibilityState={{ disabled: controlsDisabled }}
          // aria-* rather than accessibilityValue: react-native-web drops the latter.
          aria-valuemin={0}
          aria-valuemax={Math.round(displayDuration)}
          aria-valuenow={Math.round(displayPosition)}
          aria-valuetext={`${formatTime(displayPosition)} / ${formatTime(displayDuration)}`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            if (controlsDisabled) return;
            if (e.nativeEvent.actionName === 'increment') skipForward();
            if (e.nativeEvent.actionName === 'decrement') skipBackward();
          }}
          testID="audio-seek"
        >
          <View style={styles.progressTrack} pointerEvents="none">
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
                controlsDisabled && styles.progressFillDisabled,
              ]}
              testID="audio-progress-fill"
            />
          </View>
          {isSeeking && !controlsDisabled && (
            <View pointerEvents="none" style={[styles.progressThumb, { left: `${progress * 100}%` }]} />
          )}
        </View>

        {/* Left zone: track info */}
        <View style={styles.leftZone}>
          <View style={styles.trackInfoRow}>
            {isPlaying && hasTrack && (
              <View style={styles.playingBarsContainer}>
                <PlayingIndicator isPlaying={isPlaying} size={16} color={colors.burgundy[500]} />
              </View>
            )}
            <TouchableOpacity
              style={styles.trackTextContainer}
              onPress={showTrackInEvent}
              disabled={!hasTrack}
              accessibilityRole="button"
              testID="audio-track-title"
            >
              <Text style={[styles.trackTitle, allDisabled && styles.idleText]} numberOfLines={1}>
                {displayTitle || (t('player.noTrack') || 'No track selected')}
              </Text>
              {displaySubtitle ? (
                <Text style={styles.trackSubtitle} numberOfLines={1}>
                  {displaySubtitle}
                </Text>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        {/* Center zone: elapsed | transport controls | remaining, as on the phone player */}
        <View style={styles.centerZone}>
          <View style={styles.transportRow}>
            <Text
              style={[styles.timeText, controlsDisabled && styles.timeTextDisabled]}
              testID="audio-current-time"
            >
              {formatTime(displayPosition)}
            </Text>

            {/* Previous */}
            <TouchableOpacity
              onPress={previousTrack}
              style={[styles.transportButton, (controlsDisabled || !hasPreviousTrack) && styles.transportDisabled]}
              disabled={controlsDisabled || !hasPreviousTrack}
            >
              <Ionicons
                name="play-skip-back"
                size={18}
                color={!controlsDisabled && hasPreviousTrack ? colors.gray[700] : colors.gray[400]}
              />
            </TouchableOpacity>

            {/* Skip backward 15s — interactive once a real track is loaded;
                during the brief loading phase the tap is ignored. */}
            <TouchableOpacity
              onPress={skipBackward}
              style={[styles.skipButton, controlsDisabled && styles.transportDisabled]}
              disabled={controlsDisabled}
              testID="audio-skip-back"
            >
              <RotateLeftThinIcon
                size={24}
                color={controlsDisabled ? colors.gray[400] : colors.gray[700]}
                strokeWidth={1.5}
              />
              <Text style={[styles.skipNumber, controlsDisabled && styles.skipNumberDisabled]}>
                15
              </Text>
            </TouchableOpacity>

            {/* Play / Pause — wrapped so the optional loading ring sits
                concentric with the button. */}
            <View style={styles.playButtonWrapper}>
              {showLoadingRing && (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.loadingRing, { transform: [{ rotate: ringRotation }] }]}
                />
              )}
              {/* A black triangle, no red disc: the phone player's look (André). */}
              <TouchableOpacity
                onPress={hasIdleTrack ? resumeLastPlayed : togglePlayPause}
                style={[styles.playButton, allDisabled && styles.playButtonDisabled]}
                disabled={allDisabled}
                testID="audio-play-pause"
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? t('common.pause') || 'Pause' : t('common.play') || 'Play'}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={28}
                  color={colors.gray[800]}
                />
              </TouchableOpacity>
            </View>

            {/* Skip forward 15s */}
            <TouchableOpacity
              onPress={skipForward}
              style={[styles.skipButton, controlsDisabled && styles.transportDisabled]}
              disabled={controlsDisabled}
              testID="audio-skip-forward"
            >
              <RotateRightThinIcon
                size={24}
                color={controlsDisabled ? colors.gray[400] : colors.gray[700]}
                strokeWidth={1.5}
              />
              <Text style={[styles.skipNumber, controlsDisabled && styles.skipNumberDisabled]}>
                15
              </Text>
            </TouchableOpacity>

            {/* Next */}
            <TouchableOpacity
              onPress={nextTrack}
              style={[styles.transportButton, (controlsDisabled || !hasNextTrack) && styles.transportDisabled]}
              disabled={controlsDisabled || !hasNextTrack}
            >
              <Ionicons
                name="play-skip-forward"
                size={18}
                color={!controlsDisabled && hasNextTrack ? colors.gray[700] : colors.gray[400]}
              />
            </TouchableOpacity>

            <Text
              style={[styles.timeText, controlsDisabled && styles.timeTextDisabled]}
              testID="audio-remaining-time"
            >
              {formatTimeRemaining(displayPosition, displayDuration)}
            </Text>
          </View>
        </View>

        {/* Right zone: bookmark / speed / read-along / language — mobile-style mini
            buttons (icon stacked over a small label). Each button is
            conditional on a handler being registered by the current screen. */}
        <View style={styles.rightZone}>
          {/* Same order as the phone toolbar: bookmark, speed, read along, language. */}
          <TouchableOpacity
            onPress={trackBookmark?.onToggle}
            style={[styles.toolbarButton, !trackBookmark && styles.toolbarButtonDisabled]}
            disabled={!trackBookmark}
            testID="audio-bookmark"
            accessibilityLabel={t('player.bookmark') || 'bookmark'}
          >
            <Ionicons
              name={trackBookmark?.isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={trackBookmark?.isBookmarked ? colors.burgundy[500] : colors.gray[600]}
            />
            <Text
              style={[
                styles.toolbarLabel,
                trackBookmark?.isBookmarked && { color: colors.burgundy[500] },
              ]}
            >
              {t('player.bookmark') || 'bookmark'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={changePlaybackSpeed}
            style={styles.toolbarButton}
            disabled={controlsDisabled}
            testID="audio-speed"
          >
            <Text style={[styles.speedValue, controlsDisabled && styles.speedTextDisabled]}>
              x{playbackSpeed}
            </Text>
            <Text style={[styles.toolbarLabel, controlsDisabled && styles.speedTextDisabled]}>
              {t('player.speed') || 'speed'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={canOpenReadAlong ? openReadAlong : undefined}
            style={[styles.toolbarButton, !canOpenReadAlong && styles.toolbarButtonDisabled]}
            disabled={!canOpenReadAlong}
            testID="audio-read-along"
            accessibilityLabel={t('readAlong.title') || 'Read Along'}
            accessibilityState={{ disabled: !canOpenReadAlong }}
          >
            <Ionicons name="book-outline" size={20} color={colors.gray[600]} />
            <Text style={styles.toolbarLabel}>
              {t('player.read') || 'Read Along'}
            </Text>
          </TouchableOpacity>

          {/* Language globe: shown only when the event screen offers the
              picker (same condition as the phone), same checkbox list. */}
          {languageControl && (
            <View style={styles.languageWrapper}>
              <TouchableOpacity
                onPress={() => setLanguageOpen((open) => !open)}
                style={styles.toolbarButton}
                testID="audio-language"
                accessibilityLabel={languageControl.label}
              >
                <Ionicons name="globe-outline" size={20} color={colors.gray[600]} />
                <Text style={[styles.toolbarLabel, styles.languageLabel]} numberOfLines={1}>
                  {languageControl.label}
                </Text>
              </TouchableOpacity>
              {languageOpen && (
                <View style={styles.languagePopover} testID="audio-language-popover">
                  <LanguageCheckboxList
                    options={languageControl.options}
                    selected={languageControl.selected}
                    onChange={languageControl.onChange}
                    t={t}
                  />
                </View>
              )}
            </View>
          )}
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  // ── Compact player bar ──────────────────────────────────────────
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 80,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
  },

  // Progress line on the bar's top edge. The shell draws a 1px border there; the line's track
  // sits right over it (top -1) so the border itself reads as the progress line.
  progressHitArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -1 - (PROGRESS_HIT_HEIGHT - PROGRESS_LINE_HEIGHT) / 2,
    height: PROGRESS_HIT_HEIGHT,
    justifyContent: 'center',
    zIndex: 20,
    cursor: 'pointer',
  } as object,
  progressTrack: {
    height: PROGRESS_LINE_HEIGHT,
    backgroundColor: colors.gray[200],
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.burgundy[500],
  },
  progressFillDisabled: {
    backgroundColor: colors.gray[300],
  },
  progressThumb: {
    position: 'absolute',
    top: PROGRESS_HIT_HEIGHT / 2 - 6,
    width: 12,
    height: 12,
    marginLeft: -6,
    borderRadius: 6,
    backgroundColor: colors.burgundy[500],
  },

  // Loading overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // Left zone — same flex as rightZone so centerZone is truly centered
  leftZone: {
    flex: 1,
    paddingRight: 16,
    justifyContent: 'center',
  },
  trackInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playingBarsContainer: {
    marginRight: 10,
  },
  trackTextContainer: {
    flex: 1,
  },
  trackTitle: {
    // Regular weight at 1.3x the former 14pt (André).
    fontSize: 18,
    fontFamily: 'EBGaramond_400Regular',
    color: colors.gray[800],
  },
  trackSubtitle: {
    fontSize: 12,
    color: colors.gray[500],
    marginTop: 2,
  },
  idleText: {
    color: colors.gray[400],
    fontWeight: '500',
  },

  // Center zone
  centerZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  transportButton: {
    padding: 6,
  },
  transportDisabled: {
    opacity: 0.5,
  },
  skipButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipNumber: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.gray[600],
    position: 'absolute',
  },
  skipNumberDisabled: {
    color: colors.gray[400],
  },
  playButtonWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonDisabled: {
    opacity: 0.4,
  },
  loadingRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: colors.burgundy[500],
  },
  // Same as the phone player's times: red, beside the controls.
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.burgundy[500],
    minWidth: 52,
    textAlign: 'center',
  },
  timeTextDisabled: {
    color: colors.gray[400],
  },

  // Right zone — same flex as leftZone so centerZone is truly centered
  rightZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    paddingLeft: 16,
  },
  // Mobile-style mini button: icon (or value) on top, small label below.
  toolbarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },
  toolbarButtonDisabled: {
    opacity: 0.4,
  },
  toolbarLabel: {
    fontSize: 10,
    color: colors.gray[500],
    marginTop: 2,
  },
  languageWrapper: {
    position: 'relative',
    zIndex: 100,
  },
  languageLabel: {
    maxWidth: 96,
  },
  // Opens upwards from the globe: the bar sits at the bottom of the window.
  languagePopover: {
    position: 'absolute',
    bottom: '100%',
    right: 0,
    marginBottom: 8,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 200,
    overflow: 'hidden',
  },
  speedValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray[700],
  },
  speedTextDisabled: {
    color: colors.gray[400],
  },
});
