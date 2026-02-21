import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslatedName } from '@/utils/i18n';
import { Track } from '@/types';

const colors = {
  cream: {
    50: '#fefdfb',
    100: '#fcf8f3',
  },
  burgundy: {
    50: '#fef2f2',
    500: '#b91c1c',
    600: '#991b1b',
    700: '#7f1d1d',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
  },
  white: '#ffffff',
};

interface TrackWithSession extends Track {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  sessionType: string;
}

interface RetreatInfo {
  id: string;
  name: string;
  name_translations?: Record<string, string>;
  year: number;
  startDate: string;
  endDate: string;
  sessions: {
    id: string;
    tracks?: Track[];
  }[];
  retreat_group: {
    id: string;
    name: string;
    name_translations?: Record<string, string>;
  };
}

interface TrackDetailPanelProps {
  track: TrackWithSession | null;
  retreat: RetreatInfo;
  onPlayTrack?: () => void;
  isCurrentlyPlaying?: boolean;
}

export function TrackDetailPanel({ track, retreat, onPlayTrack, isCurrentlyPlaying }: TrackDetailPanelProps) {
  const { t, language } = useLanguage();

  const formatDurationLong = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateRange = (startDateStr: string, endDateStr: string) => {
    try {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      const startMonth = startDate.toLocaleDateString('en-US', { month: 'long' });
      const endMonth = endDate.toLocaleDateString('en-US', { month: 'long' });
      const startDay = startDate.getDate();
      const endDay = endDate.getDate();

      const getOrdinal = (n: number) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };

      if (startMonth === endMonth) {
        return `${startMonth} ${getOrdinal(startDay)} - ${getOrdinal(endDay)}, ${startDate.getFullYear()}`;
      }
      return `${startMonth} ${getOrdinal(startDay)} - ${endMonth} ${getOrdinal(endDay)}, ${startDate.getFullYear()}`;
    } catch {
      return `${startDateStr} - ${endDateStr}`;
    }
  };

  // No track selected: show retreat overview
  if (!track) {
    const totalSessions = retreat.sessions?.length || 0;
    const totalTracks = retreat.sessions?.reduce(
      (sum, s) => sum + (s.tracks?.length || 0),
      0
    ) || 0;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.overviewContainer}>
          <Ionicons name="musical-notes-outline" size={48} color={colors.gray[400]} />
          <Text style={styles.overviewTitle}>
            {getTranslatedName(retreat, language) || retreat.name}
          </Text>
          <Text style={styles.overviewSubtitle}>
            {getTranslatedName(retreat.retreat_group, language) || retreat.retreat_group.name}
          </Text>
          <Text style={styles.overviewDate}>
            {formatDateRange(retreat.startDate, retreat.endDate)}
          </Text>
          <View style={styles.overviewStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalSessions}</Text>
              <Text style={styles.statLabel}>
                {t('trackDetail.totalSessions', { count: String(totalSessions) }) || `${totalSessions} sessions`}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalTracks}</Text>
              <Text style={styles.statLabel}>
                {t('trackDetail.totalTracks', { count: String(totalTracks) }) || `${totalTracks} tracks`}
              </Text>
            </View>
          </View>
          <Text style={styles.selectPrompt}>
            {t('trackDetail.selectTrack') || 'Select a track from the list to see details'}
          </Text>
        </View>
      </ScrollView>
    );
  }

  // Track selected: show track detail
  const sessionDate = new Date(track.sessionDate);
  const formattedDate = sessionDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Track number badge */}
      <View style={styles.trackBadge}>
        <Text style={styles.trackBadgeText}>
          {t('trackDetail.trackNumber', { number: String(track.order) }) || `Track ${track.order}`}
        </Text>
      </View>

      {/* Track title */}
      <Text style={styles.trackTitle}>{track.title}</Text>

      {/* Translation indicator */}
      {!track.isOriginal && track.language && (
        <View style={styles.translationBadge}>
          <Ionicons name="language-outline" size={14} color={colors.burgundy[600]} />
          <Text style={styles.translationText}>
            {t('trackDetail.translation') || 'Translation'} ({track.language.toUpperCase()})
          </Text>
        </View>
      )}

      {/* Metadata rows */}
      <View style={styles.metadataSection}>
        <View style={styles.metadataRow}>
          <Ionicons name="time-outline" size={18} color={colors.gray[500]} />
          <Text style={styles.metadataLabel}>{t('trackDetail.duration') || 'Duration'}</Text>
          <Text style={styles.metadataValue}>{formatDurationLong(track.duration)}</Text>
        </View>
        <View style={styles.metadataRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.gray[500]} />
          <Text style={styles.metadataLabel}>{t('trackDetail.session') || 'Session'}</Text>
          <Text style={styles.metadataValue}>{track.sessionName}</Text>
        </View>
        <View style={styles.metadataRow}>
          <Ionicons name="today-outline" size={18} color={colors.gray[500]} />
          <Text style={styles.metadataLabel}>{formattedDate}</Text>
        </View>
      </View>

      {/* Play button */}
      <TouchableOpacity
        style={styles.playButton}
        onPress={onPlayTrack}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isCurrentlyPlaying ? 'pause' : 'play'}
          size={20}
          color={colors.white}
        />
        <Text style={styles.playButtonText}>
          {isCurrentlyPlaying
            ? (t('common.pause') || 'Pause')
            : (t('trackDetail.playTrack') || 'Play Track')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[50],
  },
  contentContainer: {
    padding: 32,
  },
  // Overview (no track selected)
  overviewContainer: {
    alignItems: 'center',
    paddingTop: 48,
  },
  overviewTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray[800],
    marginTop: 16,
    textAlign: 'center',
  },
  overviewSubtitle: {
    fontSize: 16,
    color: colors.burgundy[600],
    marginTop: 4,
  },
  overviewDate: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 8,
  },
  overviewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.burgundy[500],
  },
  statLabel: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.gray[200],
  },
  selectPrompt: {
    fontSize: 14,
    color: colors.gray[400],
    marginTop: 32,
    textAlign: 'center',
  },
  // Track detail
  trackBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.burgundy[50],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16,
  },
  trackBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.burgundy[600],
  },
  trackTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray[800],
    lineHeight: 32,
  },
  translationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  translationText: {
    fontSize: 13,
    color: colors.burgundy[600],
    fontWeight: '500',
  },
  metadataSection: {
    marginTop: 24,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  metadataLabel: {
    fontSize: 14,
    color: colors.gray[600],
    flex: 1,
  },
  metadataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[800],
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.burgundy[500],
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 32,
    gap: 8,
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
