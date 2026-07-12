import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors } from '@/constants/colors';
import type { Session, SessionVideo } from '@/types';

/** One card in the grid: a single recording, plus the session it belongs to
 *  (needed for title formatting and for opening the player). */
export interface VideoGridItem {
  session: Session;
  video: SessionVideo;
}

interface VideoGridProps {
  items: VideoGridItem[];
  onPlay: (item: VideoGridItem) => void;
  /** Renders the session's display title — passed in so the grid stays
   *  agnostic of how titles are formatted on the parent screen. When a
   *  session has more than one video, the grid appends a " — Part N" (or
   *  the video's own title, if set) suffix automatically. */
  renderTitle: (session: Session) => string;
  /** Formats a SessionVideo's `durationSeconds` for the duration chip. */
  formatDuration: (seconds: number) => string;
}

export function VideoGrid({ items, onPlay, renderTitle, formatDuration }: VideoGridProps) {
  const { isDesktop } = useDesktopLayout();
  const { t } = useLanguage();
  // 3 columns on desktop, 2 on tablet-ish, 1 on phone.
  const columns = isDesktop ? 3 : 1;

  return (
    <View style={[styles.grid, { gap: isDesktop ? 16 : 12 }]}>
      {items.map(({ session, video }) => {
        const baseTitle = renderTitle(session);
        const hasMultipleVideos = (session.videos?.length ?? 0) > 1;
        const partLabel =
          video.title || t('session.part', { n: video.position + 1 }) || `Part ${video.position + 1}`;
        const title = hasMultipleVideos ? `${baseTitle} — ${partLabel}` : baseTitle;

        return (
          <View
            key={video.id}
            style={[
              styles.cellWrapper,
              { width: `${100 / columns}%` as any },
            ]}
          >
            <VideoSessionCard
              video={video}
              title={title}
              onPress={() => onPlay({ session, video })}
              formatDuration={formatDuration}
            />
          </View>
        );
      })}
    </View>
  );
}

interface CardProps {
  video: SessionVideo;
  title: string;
  onPress: () => void;
  formatDuration: (seconds: number) => string;
}

function VideoSessionCard({ video, title, onPress, formatDuration }: CardProps) {
  const { t } = useLanguage();
  const [thumbError, setThumbError] = useState(false);
  const [hover, setHover] = useState(false);

  const durationLabel = video.durationSeconds ? formatDuration(video.durationSeconds) : '';

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
        {video.posterUrl && !thumbError ? (
          <ExpoImage
            source={{ uri: video.posterUrl }}
            style={StyleSheet.absoluteFill as any}
            contentFit="cover"
            transition={150}
            onError={() => setThumbError(true)}
          />
        ) : (
          <View style={styles.thumbnailFallback} />
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
