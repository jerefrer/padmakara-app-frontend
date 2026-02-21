import { AnimatedPlayingBars } from '@/components/AnimatedPlayingBars';
import { RotateLeftThinIcon } from '@/components/icons/RotateLeftThinIcon';
import { RotateRightThinIcon } from '@/components/icons/RotateRightThinIcon';
import { colors } from '@/constants/colors';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
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

const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
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
    trackList,
    currentTrackIndex,
    idleTrack,
    resumeLastPlayed,
  } = useAudioPlayerContext();

  const [isExpanded, setIsExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const toggleExpanded = useCallback(() => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isExpanded, slideAnim]);

  const collapse = useCallback(() => {
    if (!isExpanded) return;
    setIsExpanded(false);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isExpanded, slideAnim]);

  // Escape key closes expanded panel on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isExpanded) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        collapse();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isExpanded, collapse]);

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

  // Up next tracks: next 5 tracks after current
  const upNextTracks = hasTrack ? trackList.slice(currentTrackIndex + 1, currentTrackIndex + 6) : [];

  // Animated height for expanded panel (60vh)
  const expandedHeight = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const overlayOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });

  // All controls disabled when no track and no idle track
  const allDisabled = !hasTrack && !hasIdleTrack;
  // Only play button enabled for idle track (others need actual audio)
  const controlsDisabled = !hasTrack;

  return (
    <>
      {/* Overlay behind expanded panel */}
      {isExpanded && hasTrack && (
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            styles.overlay,
          ]}
          onPress={collapse}
          accessibilityRole="button"
          accessibilityLabel={t('player.close') || 'Close'}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: '#000', opacity: overlayOpacity },
            ]}
          />
        </Pressable>
      )}

      {/* Expanded "Now Playing" panel */}
      {isExpanded && hasTrack && (
        <Animated.View
          style={[
            styles.expandedPanel,
            {
              opacity: expandedHeight,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [200, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header row */}
          <View style={styles.expandedHeader}>
            <TouchableOpacity
              onPress={collapse}
              style={styles.expandedHeaderButton}
              accessibilityRole="button"
              accessibilityLabel={t('player.close') || 'Close'}
            >
              <Ionicons name="chevron-down" size={22} color={colors.gray[600]} />
            </TouchableOpacity>
            <Text style={styles.expandedHeaderTitle}>
              {t('player.nowPlaying') || 'Now Playing'}
            </Text>
            <TouchableOpacity
              onPress={collapse}
              style={styles.expandedHeaderButton}
              accessibilityRole="button"
              accessibilityLabel={t('player.close') || 'Close'}
            >
              <Ionicons name="close" size={22} color={colors.gray[600]} />
            </TouchableOpacity>
          </View>

          {/* Two-column layout */}
          <View style={styles.expandedContent}>
            {/* Left column: 40% - controls */}
            <View style={styles.expandedLeft}>
              {/* Large track title */}
              <Text style={styles.expandedTrackTitle} numberOfLines={2}>
                {currentTrack.title}
              </Text>
              {displaySubtitle ? (
                <Text style={styles.expandedSubtitle} numberOfLines={1}>
                  {displaySubtitle}
                </Text>
              ) : null}

              {/* Transport controls (larger) */}
              <View style={styles.expandedTransportRow}>
                <TouchableOpacity
                  onPress={previousTrack}
                  style={[
                    styles.expandedTransportButton,
                    !hasPreviousTrack && styles.transportDisabled,
                  ]}
                  disabled={!hasPreviousTrack}
                >
                  <Ionicons
                    name="play-skip-back"
                    size={22}
                    color={hasPreviousTrack ? colors.gray[600] : colors.gray[400]}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={skipBackward}
                  style={[
                    styles.expandedSkipButton,
                    isPlayButtonDisabled && styles.transportDisabled,
                  ]}
                  disabled={isPlayButtonDisabled}
                >
                  <RotateLeftThinIcon
                    size={30}
                    color={isPlayButtonDisabled ? colors.gray[400] : colors.gray[600]}
                    strokeWidth={1.5}
                  />
                  <Text
                    style={[
                      styles.expandedSkipNumber,
                      isPlayButtonDisabled && styles.skipNumberDisabled,
                    ]}
                  >
                    15
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={togglePlayPause}
                  style={[
                    styles.expandedPlayButton,
                    isPlayButtonDisabled && styles.playButtonDisabled,
                  ]}
                  disabled={isPlayButtonDisabled}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={28}
                    color={colors.white}
                    style={!isPlaying ? styles.expandedPlayIconOffset : undefined}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={skipForward}
                  style={[
                    styles.expandedSkipButton,
                    isPlayButtonDisabled && styles.transportDisabled,
                  ]}
                  disabled={isPlayButtonDisabled}
                >
                  <RotateRightThinIcon
                    size={30}
                    color={isPlayButtonDisabled ? colors.gray[400] : colors.gray[600]}
                    strokeWidth={1.5}
                  />
                  <Text
                    style={[
                      styles.expandedSkipNumber,
                      isPlayButtonDisabled && styles.skipNumberDisabled,
                    ]}
                  >
                    15
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={nextTrack}
                  style={[
                    styles.expandedTransportButton,
                    !hasNextTrack && styles.transportDisabled,
                  ]}
                  disabled={!hasNextTrack}
                >
                  <Ionicons
                    name="play-skip-forward"
                    size={22}
                    color={hasNextTrack ? colors.gray[600] : colors.gray[400]}
                  />
                </TouchableOpacity>
              </View>

              {/* Progress slider */}
              <View style={styles.expandedSliderRow}>
                <Text style={styles.expandedTimeText}>{formatTime(position)}</Text>
                <Slider
                  style={styles.expandedSlider}
                  minimumValue={0}
                  maximumValue={Math.max(duration, 1)}
                  value={position}
                  onSlidingStart={onSlidingStart}
                  onSlidingComplete={onSlidingComplete}
                  onValueChange={onSliderValueChange}
                  minimumTrackTintColor={colors.burgundy[500]}
                  maximumTrackTintColor={colors.gray[300]}
                  thumbTintColor={colors.burgundy[500]}
                />
                <Text style={styles.expandedTimeText}>{formatTime(duration)}</Text>
              </View>

              {/* Speed button */}
              <View style={styles.expandedSpeedRow}>
                <TouchableOpacity
                  onPress={changePlaybackSpeed}
                  style={[
                    styles.expandedSpeedButton,
                    isPlayButtonDisabled && styles.speedButtonDisabled,
                  ]}
                  disabled={isPlayButtonDisabled}
                >
                  <Text
                    style={[
                      styles.expandedSpeedText,
                      isPlayButtonDisabled && styles.speedTextDisabled,
                    ]}
                  >
                    {playbackSpeed}x
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right column: 60% - metadata + up next */}
            <View style={styles.expandedRight}>
              {/* Track metadata */}
              <View style={styles.metadataSection}>
                <Text style={styles.metadataSectionTitle}>
                  {t('player.trackMetadata') || 'Track Details'}
                </Text>
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>
                    {t('trackDetail.duration') || 'Duration'}
                  </Text>
                  <Text style={styles.metadataValue}>{formatDuration(duration)}</Text>
                </View>
                {retreatName ? (
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>
                      {t('navigation.retreats') || 'Retreat'}
                    </Text>
                    <Text style={styles.metadataValue} numberOfLines={1}>
                      {retreatName}
                    </Text>
                  </View>
                ) : null}
                {groupName ? (
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>
                      {t('groups.yourGroups') || 'Group'}
                    </Text>
                    <Text style={styles.metadataValue} numberOfLines={1}>
                      {groupName}
                    </Text>
                  </View>
                ) : null}
                {currentTrack.language ? (
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>
                      {t('profile.language') || 'Language'}
                    </Text>
                    <Text style={styles.metadataValue}>
                      {currentTrack.language === 'pt' ? 'Portuguese' : 'English'}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Up Next section */}
              {upNextTracks.length > 0 && (
                <View style={styles.upNextSection}>
                  <Text style={styles.upNextTitle}>
                    {t('player.upNext') || 'Up Next'}
                  </Text>
                  {upNextTracks.map((track, index) => (
                    <View key={track.id} style={styles.upNextItem}>
                      <Text style={styles.upNextIndex}>{index + 1}</Text>
                      <View style={styles.upNextInfo}>
                        <Text style={styles.upNextTrackTitle} numberOfLines={1}>
                          {track.title}
                        </Text>
                        <Text style={styles.upNextDuration}>
                          {formatDuration(track.duration)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      )}

      {/* Compact player bar */}
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

          <TouchableOpacity
            style={[styles.expandButton, controlsDisabled && styles.transportDisabled]}
            onPress={toggleExpanded}
            disabled={controlsDisabled}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded
                ? (t('player.close') || 'Close')
                : (t('player.nowPlaying') || 'Now Playing')
            }
          >
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-up'}
              size={20}
              color={controlsDisabled ? colors.gray[400] : colors.gray[600]}
            />
          </TouchableOpacity>
        </View>
      </View>
    </>
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
    borderRadius: 12,
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
  expandButton: {
    padding: 6,
  },

  // ── Overlay ─────────────────────────────────────────────────────
  overlay: {
    zIndex: 50,
  },

  // ── Expanded panel ──────────────────────────────────────────────
  expandedPanel: {
    position: 'absolute',
    bottom: 80, // sits above compact bar
    left: 0,
    right: 0,
    height: '60%', // ~60vh via percentage of parent
    backgroundColor: colors.white,
    zIndex: 51,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },

  // Expanded header
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  expandedHeaderButton: {
    padding: 8,
    borderRadius: 8,
  },
  expandedHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[500],
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Expanded content layout
  expandedContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 40,
  },

  // Left column (40%)
  expandedLeft: {
    flex: 4,
    justifyContent: 'center',
  },
  expandedTrackTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray[800],
    marginBottom: 6,
  },
  expandedSubtitle: {
    fontSize: 14,
    color: colors.gray[500],
    marginBottom: 28,
  },

  // Expanded transport controls
  expandedTransportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  expandedTransportButton: {
    padding: 8,
  },
  expandedSkipButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedSkipNumber: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.gray[600],
    position: 'absolute',
  },
  expandedPlayButton: {
    backgroundColor: colors.burgundy[500],
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedPlayIconOffset: {
    marginLeft: 3,
  },

  // Expanded slider
  expandedSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  expandedSlider: {
    flex: 1,
    height: 24,
    marginHorizontal: 12,
  },
  expandedTimeText: {
    fontSize: 13,
    color: colors.gray[500],
    minWidth: 42,
    textAlign: 'center',
  },

  // Expanded speed
  expandedSpeedRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  expandedSpeedButton: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  expandedSpeedText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.burgundy[500],
  },

  // Right column (60%)
  expandedRight: {
    flex: 6,
    paddingLeft: 20,
    borderLeftWidth: 1,
    borderLeftColor: colors.gray[200],
  },

  // Metadata section
  metadataSection: {
    marginBottom: 24,
  },
  metadataSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[500],
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  metadataLabel: {
    fontSize: 13,
    color: colors.gray[500],
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 13,
    color: colors.gray[800],
    fontWeight: '600',
    maxWidth: '60%',
  },

  // Up Next section
  upNextSection: {
    flex: 1,
  },
  upNextTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[500],
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  upNextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  upNextIndex: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[400],
    width: 20,
    textAlign: 'center',
  },
  upNextInfo: {
    flex: 1,
    marginLeft: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upNextTrackTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray[700],
    flex: 1,
    marginRight: 12,
  },
  upNextDuration: {
    fontSize: 12,
    color: colors.gray[400],
  },
});
