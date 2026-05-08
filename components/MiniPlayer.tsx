import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router, useSegments } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';

const BAR_HEIGHT = 60;
const BURGUNDY = '#9b1b1b';
const GRAY_TEXT = '#6b7280';
const GRAY_BORDER = '#e5e7eb';

function isOnOwningEvent(segments: string[], retreatId: string | null): boolean {
  if (!retreatId) return false;
  // Expected pattern when on the event screen:
  //   ['(tabs)', '(groups)', 'retreat', '<id>']
  // We accept any position as long as the segment 'retreat' is followed by
  // a segment equal to retreatId. This is robust to future route nesting.
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i] === 'retreat' && segments[i + 1] === retreatId) {
      return true;
    }
  }
  return false;
}

function makeSubtitle(groupName: string | null, retreatName: string | null): string {
  return [groupName, retreatName].filter(Boolean).join(' · ');
}

export function MiniPlayer() {
  const { t } = useLanguage();
  const segments = useSegments() as string[];
  const tabBarHeight = useBottomTabBarHeight();
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
  if (isOnOwningEvent(segments, retreatId)) return null;

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

        <Pressable
          style={styles.controlButton}
          onPress={togglePlayPause}
          accessibilityRole="button"
          accessibilityLabel={playLabel}
          hitSlop={8}
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
    paddingHorizontal: 8,
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
