import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlayingIndicator } from '@/components/PlayingIndicator';
import { useAudioPlayerContext, type IdleTrackInfo } from '@/contexts/AudioPlayerContext';
import type { Track } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { BAR_TOP_SHADOW } from '@/constants/barShadow';
import { getTrackTitle } from '@/utils/i18n';
import { requestTrackReveal } from '@/utils/trackReveal';

const BAR_HEIGHT = 60;
const BURGUNDY = '#9b1b1b';
const GRAY_TEXT = '#6b7280';
const GRAY_BORDER = '#e5e7eb';

function isOnOwningEvent(pathname: string, retreatId: string | null): boolean {
  if (!retreatId) return false;
  // The event screen path looks like "/retreat/<id>" (route groups
  // "(tabs)" and "(groups)" don't appear in URLs). Match either an exact
  // path or a deeper nested route under that event.
  return (
    pathname === `/retreat/${retreatId}` ||
    pathname.startsWith(`/retreat/${retreatId}/`)
  );
}

function makeSubtitle(groupName: string | null, retreatName: string | null): string {
  return [groupName, retreatName].filter(Boolean).join(' · ');
}

/**
 * Whether a player bar sits on top of the tab bar: the mini-player, or the
 * event screen's own player. The tab bar drops its top shadow then, since only
 * the highest bar of the stack carries one.
 */
export function usePlayerBarAboveTabBar(): boolean {
  const { inlinePlayerVisible } = useAudioPlayerContext();
  const miniPlayerContent = useMiniPlayerContent();
  return inlinePlayerVisible || miniPlayerContent !== null;
}

/** Gap kept between the end of a list and the bars floating over it. */
const BOTTOM_BARS_GAP = 16;

/**
 * Bottom padding a scrolling screen needs on a phone so its last item clears
 * the tab bar and, when one shows, the player bar above it.
 */
export function useBottomBarsSpace(): number {
  const tabBarHeight = useTabBarHeight();
  const playerShown = usePlayerBarAboveTabBar();
  return tabBarHeight + (playerShown ? BAR_HEIGHT : 0) + BOTTOM_BARS_GAP;
}

/** What the mini-player shows: the track being listened to, or the last one waiting to resume. */
interface MiniPlayerContent {
  track: Track;
  retreatId: string | null;
  subtitle: string;
  position: number;
  duration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

/**
 * The mini-player's content, or null when it stays hidden. The track being
 * listened to comes first; otherwise the last track played, restored after the
 * app restarts, waits paused until the person resumes or closes it.
 */
function useMiniPlayerContent(): MiniPlayerContent | null {
  const pathname = usePathname();
  const {
    currentTrack,
    isPlaying,
    listeningStarted,
    position,
    duration,
    retreatId,
    retreatName,
    groupName,
    togglePlayPause,
    idleTrack,
    resumeLastPlayed,
    inlinePlayerVisible,
  } = useAudioPlayerContext();

  if (currentTrack && listeningStarted) {
    if (!isListenedTrackShown(pathname, isPlaying, retreatId, inlinePlayerVisible)) return null;
    return {
      track: currentTrack,
      retreatId,
      subtitle: makeSubtitle(groupName, retreatName),
      position,
      duration,
      isPlaying,
      onTogglePlay: togglePlayPause,
    };
  }
  if (idleTrack) return idleContent(pathname, idleTrack, inlinePlayerVisible, resumeLastPlayed);
  return null;
}

function idleContent(
  pathname: string,
  idle: IdleTrackInfo,
  inlinePlayerVisible: boolean,
  resume: () => void,
): MiniPlayerContent | null {
  const retreatId = idle.meta?.retreatId ?? null;
  // An event screen showing its own player has loaded a track of its own, and
  // on its own event screen a paused track stays out of the way, as above.
  if (inlinePlayerVisible || isOnOwningEvent(pathname, retreatId)) return null;
  return {
    track: idle.track,
    retreatId,
    subtitle: makeSubtitle(idle.meta?.groupName ?? null, idle.meta?.retreatName ?? null),
    position: idle.position,
    duration: idle.duration,
    isPlaying: false,
    onTogglePlay: resume,
  };
}

/**
 * Whether a track the person played since the player was last closed shows.
 * One an event screen only loaded, paused, never brings the bar up.
 */
function isListenedTrackShown(
  pathname: string,
  isPlaying: boolean,
  retreatId: string | null,
  inlinePlayerVisible: boolean,
): boolean {
  // On the owning event screen the inline player already covers playback. When
  // that screen shows another tab (Videos, Documents) there is no player, so
  // the mini-player steps in, but only while audio is playing: a paused
  // track would just be a bar over the list with nothing to resume from.
  return !(isOnOwningEvent(pathname, retreatId) && (inlinePlayerVisible || !isPlaying));
}

export function MiniPlayer() {
  const { t, language } = useLanguage();
  const tabBarHeight = useTabBarHeight();
  const { clearTrack } = useAudioPlayerContext();
  const content = useMiniPlayerContent();

  if (!content) return null;

  const { track, retreatId, subtitle, position, duration, isPlaying, onTogglePlay } = content;
  // Share of the track played, for the red line along the top edge.
  const progress = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : null;
  const playLabel = isPlaying ? t('miniPlayer.pause') : t('miniPlayer.play');

  // Opens the event scrolled to this track: the page itself opens at its top.
  const handleOpenSession = () => {
    if (!retreatId) return;
    requestTrackReveal(track.id);
    router.push({
      pathname: '/(tabs)/(groups)/retreat/[id]',
      params: { id: retreatId },
    } as any);
  };

  return (
    // While playing, moving bars say that sound is still coming from here: a
    // still note read as a leftover from earlier. The burgundy line along the
    // top shows how far the track has played, paused or not.
    <View style={[styles.wrapper, { bottom: tabBarHeight }]}>
      {progress !== null ? (
        <View testID="miniplayer-progress" style={[styles.progress, { width: `${progress * 100}%` }]} />
      ) : null}
      <Pressable
        style={styles.surface}
        onPress={handleOpenSession}
        accessibilityRole="button"
        accessibilityLabel={t('miniPlayer.openSession')}
        testID="miniplayer"
      >
        <View style={styles.iconCircle}>
          {isPlaying ? (
            <View testID="miniplayer-playing">
              <PlayingIndicator isPlaying size={20} color={BURGUNDY} />
            </View>
          ) : (
            <Ionicons name="musical-notes-outline" size={24} color={BURGUNDY} />
          )}
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {getTrackTitle(track, language)}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        style={styles.controlButton}
        onPress={onTogglePlay}
        accessibilityRole="button"
        accessibilityLabel={playLabel}
        hitSlop={8}
        testID="miniplayer-play-pause"
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={24}
          color={BURGUNDY}
        />
      </Pressable>

      <Pressable
        style={styles.controlButton}
        onPress={clearTrack}
        accessibilityRole="button"
        accessibilityLabel={t('miniPlayer.close')}
        hitSlop={8}
      >
        <Ionicons name="close" size={22} color={GRAY_TEXT} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    ...BAR_TOP_SHADOW,
    zIndex: 50,
  },
  progress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 2,
    backgroundColor: BURGUNDY,
  },
  surface: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    color: '#111111',
    fontFamily: 'EBGaramond_400Regular',
  },
  subtitle: {
    fontSize: 12,
    color: GRAY_TEXT,
    marginTop: 2,
  },
  controlButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
