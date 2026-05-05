import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import retreatService from '@/services/retreatService';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors } from '@/constants/colors';
import type { Session } from '@/types';

interface VideoGridProps {
  sessions: Session[];
  onPlay: (session: Session) => void;
  /** Renders the session's display title — passed in so the grid stays
   *  agnostic of how titles are formatted on the parent screen. */
  renderTitle: (session: Session) => string;
  /** Formats `videoDurationSeconds` for the duration chip. */
  formatDuration: (seconds: number) => string;
}

export function VideoGrid({ sessions, onPlay, renderTitle, formatDuration }: VideoGridProps) {
  const { isDesktop } = useDesktopLayout();
  // 3 columns on desktop, 2 on tablet-ish, 1 on phone.
  const columns = isDesktop ? 3 : 1;

  return (
    <View style={[styles.grid, { gap: isDesktop ? 16 : 12 }]}>
      {sessions.map((session) => (
        <View
          key={session.id}
          style={[
            styles.cellWrapper,
            { width: `${100 / columns}%` as any },
          ]}
        >
          <VideoSessionCard
            session={session}
            title={renderTitle(session)}
            onPress={() => onPlay(session)}
            formatDuration={formatDuration}
          />
        </View>
      ))}
    </View>
  );
}

interface CardProps {
  session: Session;
  title: string;
  onPress: () => void;
  formatDuration: (seconds: number) => string;
}

function VideoSessionCard({ session, title, onPress, formatDuration }: CardProps) {
  const { t } = useLanguage();
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!session.bunnyVideoId) {
      setThumbError(true);
      return;
    }
    (async () => {
      const res = await retreatService.getSessionVideoPlaybackUrls(String(session.id));
      if (cancelled) return;
      if (res.success && res.thumbnail) {
        setThumbnailUrl(res.thumbnail);
      } else {
        setThumbError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.id, session.bunnyVideoId]);

  const durationLabel = session.videoDurationSeconds
    ? formatDuration(session.videoDurationSeconds)
    : '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      // @ts-ignore — RN Web only
      onHoverIn={() => setHover(true)}
      // @ts-ignore
      onHoverOut={() => setHover(false)}
      accessibilityRole="button"
      accessibilityLabel={`${t('video.watchSessionVideo') || 'Watch video'} — ${title}`}
    >
      <View style={styles.thumbnailWrapper}>
        {thumbnailUrl ? (
          <ExpoImage
            source={{ uri: thumbnailUrl }}
            style={StyleSheet.absoluteFill as any}
            contentFit="cover"
            transition={150}
          />
        ) : thumbError ? (
          <View style={styles.thumbnailFallback} />
        ) : (
          <View style={styles.thumbnailLoading}>
            <ActivityIndicator size="small" color={colors.gray[400]} />
          </View>
        )}

        {/* Subtle scrim so the play icon stays legible over any photo. */}
        <View style={[styles.scrim, hover && styles.scrimHover]} pointerEvents="none" />

        {/* Centered play badge */}
        <View style={styles.playBadge} pointerEvents="none">
          <Ionicons name="play" size={20} color={colors.white} style={{ marginLeft: 2 }} />
        </View>

        {/* Duration chip bottom-right */}
        {!!durationLabel && (
          <View style={styles.durationChip} pointerEvents="none">
            <Text style={styles.durationChipText}>{durationLabel}</Text>
          </View>
        )}
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  cellWrapper: {
    // Width is set inline; gap on the parent handles spacing.
  },
  card: {
    width: '100%',
  },
  cardPressed: {
    opacity: 0.9,
  },
  thumbnailWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.gray[200],
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.gray[200],
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  scrimHover: {
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 48,
    height: 48,
    marginLeft: -24,
    marginTop: -24,
    borderRadius: 24,
    backgroundColor: 'rgba(155,27,27,0.92)', // burgundy[500] @ ~92%
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChip: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  durationChipText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardTitle: {
    marginTop: 8,
    fontFamily: 'EBGaramond_500Medium',
    fontSize: 15,
    color: colors.gray[800],
    lineHeight: 20,
  },
});
