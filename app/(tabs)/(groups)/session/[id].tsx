import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AudioPlayer } from '@/components/AudioPlayer';
import { AnimatedPlayingBars } from '@/components/AnimatedPlayingBars';
import retreatService from '@/services/retreatService';
import { Track, UserProgress } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const colors = {
  cream: {
    100: '#fcf8f3',
  },
  burgundy: {
    50: '#fef2f2',
    100: '#fde6e6',
    500: '#b91c1c',
    600: '#991b1b',
    700: '#7f1d1d',
  },
  saffron: {
    50: '#fffbeb',
    500: '#f59e0b',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
  white: '#ffffff',
};

interface SessionDetails {
  id: string;
  name: string;
  type: string;
  date: string;
  tracks: Track[];
  gathering: {
    id: string;
    name: string;
  };

}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { contentLanguage, t } = useLanguage();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
  const [currentLanguageMode, setCurrentLanguageMode] = useState<string>('en');
  const [nextSessionTracks, setNextSessionTracks] = useState<Track[]>([]);
  const [retreatId, setRetreatId] = useState<string | null>(null);

  useEffect(() => {
    loadSessionDetails();
  }, [id]);

  // Load next session tracks for pre-caching across session boundaries
  const loadNextSessionTracks = useCallback(async (gatheringId: string, currentSessionDate: string) => {
    try {
      // Get retreat details to find adjacent sessions
      const retreatResponse = await retreatService.getRetreatDetails(gatheringId);
      if (retreatResponse.success && retreatResponse.data) {
        setRetreatId(gatheringId);
        const sessions = retreatResponse.data.sessions || [];

        // Sort sessions by date
        const sortedSessions = sessions.sort((a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Find current session index
        const currentIndex = sortedSessions.findIndex((s: any) => s.id === id);
        if (currentIndex >= 0 && currentIndex < sortedSessions.length - 1) {
          // Get next session
          const nextSession = sortedSessions[currentIndex + 1];
          if (nextSession?.tracks) {
            console.log(`🔮 [PRE-CACHE] Found ${nextSession.tracks.length} tracks in next session: ${nextSession.name}`);
            setNextSessionTracks(nextSession.tracks);
          }
        } else {
          console.log('🔮 [PRE-CACHE] No next session available (this is the last session)');
          // TODO: Could fetch next retreat's first session here for continuous pre-caching
        }
      }
    } catch (error) {
      console.warn('Failed to load next session tracks for pre-caching:', error);
    }
  }, [id]);

  useEffect(() => {
    if (session) {
      applyLanguageFilter();
    }
  }, [session, currentLanguageMode]);

  // Update filtered tracks when session or language mode changes
  const applyLanguageFilter = useCallback(() => {
    if (!session?.tracks) {
      setFilteredTracks([]);
      return;
    }

    // Client-side filtering based on current language mode
    let filtered: Track[] = [];

    if (currentLanguageMode === 'en') {
      // English only - show only original tracks
      filtered = session.tracks.filter(track => track.isOriginal);
    } else if (currentLanguageMode === 'en-pt') {
      // English + Portuguese - show all tracks
      filtered = session.tracks;
    } else if (currentLanguageMode === 'pt') {
      // Portuguese only - show only translation tracks
      filtered = session.tracks.filter(track => !track.isOriginal && track.language === 'pt');
    } else {
      // Default to English only
      filtered = session.tracks.filter(track => track.isOriginal);
    }

    // Sort by order
    filtered.sort((a, b) => a.order - b.order);
    setFilteredTracks(filtered);
  }, [session, currentLanguageMode]);

  // Simple progress update handler
  const handleProgressUpdate = (progress: UserProgress) => {
    // In production, this would sync with your backend
    console.log('Progress updated:', progress);
  };

  const loadSessionDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await retreatService.getSessionDetails(id);
      if (response.success && response.data) {
        // Initialize language preference: session-specific > profile default > fallback
        let initialLanguageMode = 'en'; // fallback default

        try {
          // First, try to get session-specific language preference from AsyncStorage
          const sessionLanguageKey = `session_language_${id}`;
          const storedSessionLanguage = await AsyncStorage.getItem(sessionLanguageKey);

          if (storedSessionLanguage && ['en', 'en-pt', 'pt'].includes(storedSessionLanguage)) {
            initialLanguageMode = storedSessionLanguage;
            console.log(`✅ Using stored session language: ${storedSessionLanguage}`);
          } else {
            // If no session-specific preference, use profile content language as default
            initialLanguageMode = contentLanguage || 'en';
            console.log(`✅ Using profile default language: ${initialLanguageMode}`);
          }
        } catch (storageError) {
          console.warn('Failed to load session language preference, using defaults:', storageError);
          initialLanguageMode = contentLanguage || 'en';
        }

        setCurrentLanguageMode(initialLanguageMode);
        setSession(response.data);

        // Load next session tracks for cross-session pre-caching
        if (response.data.gathering?.id) {
          loadNextSessionTracks(response.data.gathering.id, response.data.date);
        }
      } else {
        setError(response.error || 'Failed to load session details');
      }
    } catch (err) {
      setError('Failed to load session details');
      console.error('Load session error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Client-side language mode update with persistence
  const updateLanguagePreference = async (newLanguageMode: string) => {
    if (!session) return;

    try {
      // Persist session-specific language preference
      const sessionLanguageKey = `session_language_${id}`;
      await AsyncStorage.setItem(sessionLanguageKey, newLanguageMode);

      // Update local language mode state
      setCurrentLanguageMode(newLanguageMode);

      console.log(`✅ Session ${id} language preference saved: ${newLanguageMode}`);
    } catch (error) {
      console.error('Failed to save session language preference:', error);

      // Still update local state even if persistence fails
      setCurrentLanguageMode(newLanguageMode);
    }
  };

  const toggleLanguageMode = () => {
    if (!currentLanguageMode) return;
    // Cycle through: en -> en-pt -> pt -> en
    let newMode: string;
    switch (currentLanguageMode) {
      case 'en':
        newMode = 'en-pt';
        break;
      case 'en-pt':
        newMode = 'pt';
        break;
      case 'pt':
        newMode = 'en';
        break;
      default:
        newMode = 'en';
    }
    updateLanguagePreference(newMode);
  };

  const getLanguageLabel = (languageMode?: string) => {
    switch (languageMode) {
      case 'en': return t('profile.englishOnly') || 'English Only';
      case 'en-pt': return t('profile.englishPortuguese') || 'English + Portuguese';
      case 'pt': return t('profile.portugueseOnly') || 'Portuguese Only';
      default: return t('profile.englishOnly') || 'English Only';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>{t('session.loadingSession') || 'Loading session...'}</Text>
        </View>
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('session.sessionNotFound') || 'Session not found'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>{t('common.goBack') || 'Go Back'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Get all tracks in order - use filtered tracks for display
  const allTracks: Track[] = filteredTracks.length > 0 ? filteredTracks : session.tracks.sort((a, b) => a.order - b.order);

  // Track selection - simple state update
  const selectTrack = (track: Track, trackIndex: number) => {
    setCurrentTrack(track);
    setCurrentTrackIndex(trackIndex);
  };

  const goToNextTrack = () => {
    const nextIndex = currentTrackIndex + 1;
    if (nextIndex < allTracks.length) {
      const nextTrack = allTracks[nextIndex];
      selectTrack(nextTrack, nextIndex);
    }
  };

  const goToPreviousTrack = () => {
    const prevIndex = currentTrackIndex - 1;
    if (prevIndex >= 0) {
      const prevTrack = allTracks[prevIndex];
      selectTrack(prevTrack, prevIndex);
    }
  };

  const handleTrackComplete = () => {
    // Auto-advance to next track
    if (currentTrackIndex < allTracks.length - 1) {
      goToNextTrack();
    } else {
      Alert.alert(
        t('session.sessionComplete') || 'Session Complete',
        t('session.sessionCompleteMessage') || 'You have finished all tracks in this session!'
      );
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  const formatTrackInfo = (track: Track) => {
    const duration = formatDuration(track.duration);
    return duration;
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header Section - unmovable */}
      <SafeAreaView edges={['top']} style={styles.fixedHeaderContainer}>
        {/* Navigation Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.burgundy[500]} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{session.name}</Text>
            <Text style={styles.headerSubtitle}>
              {session.gathering.name} • {new Date(session.date).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Language Toggle - Client-side only */}
        {currentLanguageMode && (
          <View style={styles.languageSection}>
            <View style={styles.languageToggle}>
              <Text style={styles.languageLabel}>{t('session.tracksLanguage') || 'Tracks Language:'}</Text>
              <TouchableOpacity
                style={styles.languageButton}
                onPress={toggleLanguageMode}
              >
                <Text style={styles.languageButtonText}>
                  {getLanguageLabel(currentLanguageMode)}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.gray[600]} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tracks Header */}
        <View style={styles.tracksHeaderSection}>
          <Text style={styles.tracksTitle}>
            {t('retreats.tracks') || 'Tracks'} ({allTracks.length})
          </Text>
        </View>
      </SafeAreaView>

      {/* Scrollable Tracks List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {allTracks.map((track, trackIndex) => {
            const isCurrentTrack = currentTrack?.id === track.id;

            return (
              <TouchableOpacity
                key={track.id}
                  onPress={() => selectTrack(track, trackIndex)}
                  style={[
                    styles.trackItem,
                    isCurrentTrack && styles.currentTrackItem,
                    !track.isOriginal && styles.translationTrack
                  ]}
                >
                  {/* Track Number on the left */}
                  <View style={styles.trackNumberContainer}>
                    <Text style={[
                      styles.trackNumber,
                      isCurrentTrack && styles.currentTrackNumber
                    ]}>
                      {track.order}
                    </Text>
                  </View>

                  <View style={styles.trackInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {track.isPractice && (
                        <Ionicons name="flower-outline" size={14} color="#9c27b0" />
                      )}
                      <Text style={[
                        styles.trackTitle,
                        isCurrentTrack && styles.currentTrackTitle
                      ]}>
                        {track.title}
                      </Text>
                    </View>
                    <Text style={styles.trackDuration}>
                      {formatTrackInfo(track)}
                    </Text>
                  </View>

                <View style={styles.trackRightSection}>
                  {isCurrentTrack && (
                    <View style={styles.playingIndicator}>
                      <AnimatedPlayingBars
                        isPlaying={isTrackPlaying}
                        size={20}
                        color={colors.burgundy[500]}
                      />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      {/* Bottom-sticky Audio Player */}
      <AudioPlayer
        track={currentTrack}
        onProgressUpdate={handleProgressUpdate}
        onTrackComplete={handleTrackComplete}
        onNextTrack={currentTrackIndex < allTracks.length - 1 ? goToNextTrack : undefined}
        onPreviousTrack={currentTrackIndex > 0 ? goToPreviousTrack : undefined}
        onPlayingStateChange={setIsTrackPlaying}
        // Pre-caching: remaining tracks in session + next session tracks
        upcomingTracks={[
          ...allTracks.slice(currentTrackIndex + 1), // Remaining tracks after current
          ...nextSessionTracks, // Next session's tracks
        ]}
        retreatId={retreatId || session?.gathering?.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  fixedHeaderContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  backButtonText: {
    color: colors.burgundy[500],
    fontSize: 16,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.burgundy[500],
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.gray[600],
    marginTop: 2,
  },
  languageSection: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[700],
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray[700],
    marginRight: 4,
  },
  content: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 180, // Space for bottom player
  },
  tracksHeaderSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  tracksTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'white', // Default white border for alignment
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  currentTrackItem: {
    backgroundColor: colors.burgundy[50],
  },
  translationTrack: {
    borderLeftColor: colors.saffron[500], // Override white border with saffron
  },
  trackNumberContainer: {
    width: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: -1,
    marginRight: 4,
  },
  trackNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.gray[600],
  },
  currentTrackNumber: {
    color: colors.burgundy[600],
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 14,
    color: colors.gray[700],
    marginBottom: 4,
  },
  currentTrackTitle: {
    color: colors.burgundy[600],
    fontWeight: '600',
  },
  trackDuration: {
    fontSize: 12,
    color: colors.gray[500],
  },
  trackRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    color: colors.gray[600],
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: colors.gray[600],
    marginBottom: 20,
  },
});
