import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatTrackRange, type SessionTopicsBlock } from '@/utils/eventTopics';

interface EventTopicsProps {
  main: string | null;
  sessions: SessionTopicsBlock[];
  /** Whether this event has a track with that number. */
  hasTrack: (trackNumber: number) => boolean;
  onOpenTrack: (trackNumber: number) => void;
}

/** The Topics tab of an event: the admin's text, with links to its tracks. */
export function EventTopics({ main, sessions, hasTrack, onOpenTrack }: EventTopicsProps) {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      {main ? <Text style={styles.text}>{main}</Text> : null}
      {sessions.map((block, index) => {
        const range = block.trackRange;
        const tracks = range ? formatTrackRange(range) : '';
        const single = range?.start === range?.end;
        const label = single
          ? t('eventTopics.listenToTrack', { tracks }) || `Listen to track ${tracks}`
          : t('eventTopics.listenToTracks', { tracks }) || `Listen to tracks ${tracks}`;
        return (
          <View key={index} style={styles.block}>
            <Text style={styles.text}>{block.text}</Text>
            {range && hasTrack(range.start) ? (
              <TouchableOpacity onPress={() => onOpenTrack(range.start)} style={styles.link} accessibilityRole="link">
                <Text style={styles.linkText}>{label}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 7,
    paddingTop: 16,
    gap: 24,
  },
  block: {
    gap: 4,
  },
  text: {
    fontFamily: 'EBGaramond_400Regular',
    fontSize: 16,
    lineHeight: 22,
    color: colors.gray[700],
  },
  link: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
});
