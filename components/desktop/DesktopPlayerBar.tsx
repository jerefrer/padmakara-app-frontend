import { AnimatedPlayingBars } from '@/components/AnimatedPlayingBars';
import { RotateLeftThinIcon } from '@/components/icons/RotateLeftThinIcon';
import { RotateRightThinIcon } from '@/components/icons/RotateRightThinIcon';
import { colors } from '@/constants/colors';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React from 'react';
import {
  ActivityIndicator,
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

  return (
      <View style={styles.container}>
        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.burgundy[500]} />
          </View>
        )}

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

            {/* Skip backward 15s */}
            <TouchableOpacity
              onPress={skipBackward}
              style={[styles.skipButton, (controlsDisabled || isPlayButtonDisabled) && styles.transportDisabled]}
              disabled={controlsDisabled || isPlayButtonDisabled}
            >
              <RotateLeftThinIcon
                size={24}
                color={(controlsDisabled || isPlayButtonDisabled) ? colors.gray[400] : colors.gray[600]}
                strokeWidth={1.5}
              />
              <Text style={[styles.skipNumber, (controlsDisabled || isPlayButtonDisabled) && styles.skipNumberDisabled]}>
                15
              </Text>
            </TouchableOpacity>

            {/* Play / Pause */}
            <TouchableOpacity
              onPress={hasIdleTrack ? resumeLastPlayed : togglePlayPause}
              style={[styles.playButton, (allDisabled || (!hasIdleTrack && isPlayButtonDisabled)) && styles.playButtonDisabled]}
              disabled={allDisabled || (!hasIdleTrack && isPlayButtonDisabled)}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={22}
                color={colors.white}
                style={!isPlaying ? styles.playIconOffset : undefined}
              />
            </TouchableOpacity>

            {/* Skip forward 15s */}
            <TouchableOpacity
              onPress={skipForward}
              style={[styles.skipButton, (controlsDisabled || isPlayButtonDisabled) && styles.transportDisabled]}
              disabled={controlsDisabled || isPlayButtonDisabled}
            >
              <RotateRightThinIcon
                size={24}
                color={(controlsDisabled || isPlayButtonDisabled) ? colors.gray[400] : colors.gray[600]}
                strokeWidth={1.5}
              />
              <Text style={[styles.skipNumber, (controlsDisabled || isPlayButtonDisabled) && styles.skipNumberDisabled]}>
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

          {/* Slider + time */}
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
            style={[styles.speedButton, (controlsDisabled || isPlayButtonDisabled) && styles.speedButtonDisabled]}
            disabled={controlsDisabled || isPlayButtonDisabled}
          >
            <Text style={[styles.speedText, (controlsDisabled || isPlayButtonDisabled) && styles.speedTextDisabled]}>
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
