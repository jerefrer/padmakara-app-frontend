import { AnimatedPlayingBars } from '@/components/AnimatedPlayingBars';
import { RotateLeftThinIcon } from '@/components/icons/RotateLeftThinIcon';
import { RotateRightThinIcon } from '@/components/icons/RotateRightThinIcon';
import { colors } from '@/constants/colors';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function DesktopPlayerBar() {
  const { t } = useLanguage();
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
  } = useAudioPlayerContext();

  const hasTrack = !!currentTrack;
  const hasIdleTrack = !hasTrack && !!idleTrack;

  // Display info: use active track, or fall back to idle track for display
  const displayTitle = hasTrack
    ? currentTrack.title
    : hasIdleTrack
      ? idleTrack.track.title
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

  return (
      <View style={styles.container}>

        {/* Left zone: track info */}
        <View style={styles.leftZone}>
          <View style={styles.trackInfoRow}>
            {isPlaying && hasTrack && (
              <View style={styles.playingBarsContainer}>
                <AnimatedPlayingBars isPlaying={isPlaying} size={16} color={colors.burgundy[500]} />
              </View>
            )}
            <View style={styles.trackTextContainer}>
              <Text style={[styles.trackTitle, allDisabled && styles.idleText]} numberOfLines={1}>
                {displayTitle || (t('player.noTrack') || 'No track selected')}
              </Text>
              {displaySubtitle ? (
                <Text style={styles.trackSubtitle} numberOfLines={1}>
                  {displaySubtitle}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Center zone: transport controls + slider */}
        <View style={styles.centerZone}>
          <View style={styles.transportRow}>
            {/* Previous */}
            <TouchableOpacity
              onPress={previousTrack}
              style={[styles.transportButton, (controlsDisabled || !hasPreviousTrack) && styles.transportDisabled]}
              disabled={controlsDisabled || !hasPreviousTrack}
            >
              <Ionicons
                name="play-skip-back"
                size={18}
                color={!controlsDisabled && hasPreviousTrack ? colors.gray[600] : colors.gray[400]}
              />
            </TouchableOpacity>

            {/* Skip backward 15s — interactive once a real track is loaded;
                during the brief loading phase the tap is ignored. */}
            <TouchableOpacity
              onPress={skipBackward}
              style={[styles.skipButton, controlsDisabled && styles.transportDisabled]}
              disabled={controlsDisabled}
            >
              <RotateLeftThinIcon
                size={24}
                color={controlsDisabled ? colors.gray[400] : colors.gray[600]}
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
              <TouchableOpacity
                onPress={hasIdleTrack ? resumeLastPlayed : togglePlayPause}
                style={[styles.playButton, allDisabled && styles.playButtonDisabled]}
                disabled={allDisabled}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={22}
                  color={colors.white}
                  style={!isPlaying ? styles.playIconOffset : undefined}
                />
              </TouchableOpacity>
            </View>

            {/* Skip forward 15s */}
            <TouchableOpacity
              onPress={skipForward}
              style={[styles.skipButton, controlsDisabled && styles.transportDisabled]}
              disabled={controlsDisabled}
            >
              <RotateRightThinIcon
                size={24}
                color={controlsDisabled ? colors.gray[400] : colors.gray[600]}
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
                color={!controlsDisabled && hasNextTrack ? colors.gray[600] : colors.gray[400]}
              />
            </TouchableOpacity>
          </View>

          {/* Slider + time — interactive whenever a real track is loaded;
              gray only when there is no track at all. */}
          <View style={styles.sliderRow}>
            <Text style={[styles.timeText, controlsDisabled && styles.timeTextDisabled]}>{formatTime(displayPosition)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={Math.max(displayDuration, 1)}
              value={displayPosition}
              onSlidingStart={onSlidingStart}
              onSlidingComplete={onSlidingComplete}
              onValueChange={onSliderValueChange}
              minimumTrackTintColor={controlsDisabled ? colors.gray[300] : colors.burgundy[500]}
              maximumTrackTintColor={colors.gray[300]}
              thumbTintColor={controlsDisabled ? colors.gray[400] : colors.burgundy[500]}
              disabled={controlsDisabled}
            />
            <Text style={[styles.timeText, controlsDisabled && styles.timeTextDisabled]}>{formatTime(displayDuration)}</Text>
          </View>
        </View>

        {/* Right zone: speed + expand */}
        <View style={styles.rightZone}>
          <TouchableOpacity
            onPress={changePlaybackSpeed}
            style={[styles.speedButton, controlsDisabled && styles.speedButtonDisabled]}
            disabled={controlsDisabled}
          >
            <Text style={[styles.speedText, controlsDisabled && styles.speedTextDisabled]}>
              {playbackSpeed}x
            </Text>
          </TouchableOpacity>

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
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'EBGaramond_700Bold',
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
    gap: 12,
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
    backgroundColor: colors.burgundy[500],
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  playIconOffset: {
    marginLeft: 2,
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
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
    marginTop: 2,
  },
  slider: {
    flex: 1,
    height: 20,
    marginHorizontal: 8,
  },
  timeText: {
    fontSize: 11,
    color: colors.gray[500],
    minWidth: 36,
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
    gap: 12,
    paddingLeft: 16,
  },
  speedButton: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
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
});
