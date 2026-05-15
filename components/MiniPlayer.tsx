import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';

const BAR_HEIGHT = 60;
const TAB_BAR_HEIGHT = 49;
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

export function MiniPlayer() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;
  const {
    currentTrack,
    isPlaying,
    retreatId,
    retreatName,
    groupName,
    togglePlayPause,
    clearTrack,
  } = useAudioPlayerContext();

  if (!currentTrack) return null;
  if (isOnOwningEvent(pathname, retreatId)) return null;

  const subtitle = makeSubtitle(groupName, retreatName);
  const playLabel = isPlaying ? t('miniPlayer.pause') : t('miniPlayer.play');

  const handleOpenSession = () => {
    if (!retreatId) return;
    router.push({
      pathname: '/(tabs)/(groups)/retreat/[id]',
      params: { id: retreatId },
    } as any);
  };

  return (
    <View style={[styles.wrapper, { bottom: tabBarHeight }]}>
      <Pressable
        style={styles.surface}
        onPress={handleOpenSession}
        accessibilityRole="button"
        accessibilityLabel={t('miniPlayer.openSession')}
        testID="miniplayer"
      >
        <View style={styles.iconCircle}>
          <Ionicons name="musical-notes-outline" size={24} color={BURGUNDY} />
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title}
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
        onPress={togglePlayPause}
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
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: -1 },
    elevation: 4,
    zIndex: 50,
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
