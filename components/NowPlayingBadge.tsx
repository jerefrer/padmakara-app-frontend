import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LevelTrail } from '@/components/LevelTrail';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';

const BURGUNDY = '#9b1b1b';

/**
 * Marks an event card while one of its recordings is playing, so a listener
 * browsing other teachings can see where the sound comes from. Nothing while
 * paused: the mini-player already holds a paused teaching.
 */
export function NowPlayingBadge({ eventId }: { eventId: number | string }) {
  const { t } = useLanguage();
  const { currentTrack, isPlaying, retreatId } = useAudioPlayerContext();

  if (!currentTrack || !isPlaying || retreatId !== String(eventId)) return null;

  return (
    <View style={styles.badge} accessibilityRole="text">
      <LevelTrail isPlaying size={12} color={BURGUNDY} />
      <Text style={styles.label}>{t('player.nowPlaying') || 'Now Playing'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  label: {
    fontSize: 12,
    color: BURGUNDY,
    letterSpacing: 0.3,
  },
});
