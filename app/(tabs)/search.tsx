import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/components/ui/AppHeader';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import retreatService from '@/services/retreatService';
import type { SearchResultEvent } from '@/types';

const colors = {
  cream: { 50: '#ffffff', 100: '#fefefe' },
  burgundy: { 50: '#f8f1f1', 100: '#fee2e2', 500: '#9b1b1b', 600: '#7b1616' },
  gray: {
    100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
    400: '#9ca3af', 500: '#6b7280', 600: '#4b5563',
    700: '#374151', 800: '#2c2c2c',
  },
  white: '#ffffff',
};

const FIELD_LABEL_MAP: Record<string, string> = {
  sessionThemes: 'search.fieldSessionThemes',
  mainThemes: 'search.fieldMainThemes',
  title: 'search.fieldTitle',
  teacher: 'search.fieldTeacher',
  trackTitle: 'search.fieldTrackTitle',
};

// ─── Result card ─────────────────────────────────────────────────────────────

function ResultEventCard({
  result,
  language,
  t,
  onSessionPress,
}: {
  result: SearchResultEvent;
  language: string;
  t: (key: string) => string;
  onSessionPress: (eventId: number) => void;
}) {
  const eventTitle =
    language === 'pt' && result.event.titlePt
      ? result.event.titlePt
      : result.event.titleEn;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString(
        language === 'pt' ? 'pt-PT' : 'en-US',
        { month: 'short', day: 'numeric', year: 'numeric' },
      );
    } catch {
      return dateStr;
    }
  };

  // Collect all matched track names across sessions
  const allMatchedTracks: string[] = [];
  for (const session of result.sessions) {
    for (const track of session.matchedTracks) {
      allMatchedTracks.push(track.title);
    }
  }

  return (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => onSessionPress(result.event.id)}
      activeOpacity={0.7}
    >
      {/* Event header */}
      <View style={styles.resultCardHeader}>
        <View style={styles.resultCardTitleRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.burgundy[500]} />
          <Text style={styles.resultEventTitle} numberOfLines={2}>
            {eventTitle}
          </Text>
        </View>
        {result.event.teachers.length > 0 && (
          <Text style={styles.resultTeachers} numberOfLines={1}>
            {result.event.teachers.join(', ')}
          </Text>
        )}
        {result.event.startDate && (
          <Text style={styles.resultDate}>{formatDate(result.event.startDate)}</Text>
        )}
      </View>

      {/* Why it matched — snippets from themes/title */}
      {result.snippets && result.snippets.length > 0 && (
        <View style={styles.snippetsContainer}>
          {result.snippets.map((snippet, idx) => (
            <View key={idx} style={styles.snippetRow}>
              <Text style={styles.snippetField}>
                {t(FIELD_LABEL_MAP[snippet.field] || snippet.field) || snippet.field}
              </Text>
              <Text style={styles.snippetText} numberOfLines={3}>
                {snippet.text}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Matched tracks listed by name */}
      {allMatchedTracks.length > 0 && (
        <View style={styles.matchedTracksContainer}>
          <Text style={styles.matchedTracksLabel}>
            {t('search.matchedTracks') || 'Matching tracks'}
          </Text>
          {allMatchedTracks.slice(0, 5).map((title, idx) => (
            <View key={idx} style={styles.matchedTrackRow}>
              <Ionicons name="musical-note" size={12} color={colors.gray[400]} />
              <Text style={styles.matchedTrackText} numberOfLines={1}>
                {title}
              </Text>
            </View>
          ))}
          {allMatchedTracks.length > 5 && (
            <Text style={styles.matchedTracksMore}>
              +{allMatchedTracks.length - 5} more
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const { t, language } = useLanguage();
  const { isDesktop } = useDesktopLayout();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultEvent[] | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults(null);
        setTotalResults(0);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await retreatService.search(q, language);
        if (response.success && response.data) {
          setResults(response.data.results);
          setTotalResults(response.data.totalResults);
        } else {
          setError(response.error || 'Search failed');
        }
      } catch {
        setError('Search failed');
      } finally {
        setLoading(false);
      }
    },
    [language],
  );

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => performSearch(text.trim()), 400);
    },
    [performSearch],
  );

  const handleEventPress = (eventId: number) => {
    router.push({
      pathname: '/(tabs)/(groups)/retreat/[id]',
      params: { id: String(eventId), from: 'search' },
    } as any);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, header: () => <AppHeader /> }} />
      <View style={styles.container}>
        {/* Search input */}
        <View style={[styles.searchBar, isDesktop && styles.searchBarDesktop]}>
          <View style={styles.searchInputWrapper}>
            <Ionicons
              name="search"
              size={20}
              color={colors.gray[400]}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={t('search.placeholder') || 'Search by topic or teacher'}
              placeholderTextColor={colors.gray[400]}
              value={query}
              onChangeText={handleQueryChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setQuery('');
                  setResults(null);
                  setTotalResults(0);
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.gray[400]} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results */}
        <ScrollView
          style={styles.resultsList}
          contentContainerStyle={[
            styles.resultsContent,
            isDesktop && styles.resultsContentDesktop,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {loading && (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={colors.burgundy[500]} />
              <Text style={styles.statusText}>
                {t('search.searching') || 'Searching...'}
              </Text>
            </View>
          )}

          {!loading && query.length > 0 && query.length < 2 && (
            <View style={styles.statusContainer}>
              <Ionicons name="information-circle-outline" size={20} color={colors.gray[400]} />
              <Text style={styles.statusText}>
                {t('search.minChars') || 'Type at least 2 characters'}
              </Text>
            </View>
          )}

          {!loading && results && results.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyTitle}>
                {t('search.noResults') || 'No results found'}
              </Text>
              <Text style={styles.emptyText}>
                {t('search.noResultsDescription') ||
                  'Try different keywords or check the spelling'}
              </Text>
            </View>
          )}

          {!loading && results && results.length > 0 && (
            <>
              <Text style={styles.resultsCount}>
                {totalResults === 1
                  ? (t('search.resultsCount') || '{{count}} result').replace(
                      '{{count}}',
                      '1',
                    )
                  : (t('search.resultsCountPlural') || '{{count}} results').replace(
                      '{{count}}',
                      String(totalResults),
                    )}
              </Text>
              {results.map((result) => (
                <ResultEventCard
                  key={result.event.id}
                  result={result}
                  language={language}
                  t={t}
                  onSessionPress={handleEventPress}
                />
              ))}
            </>
          )}

          {!loading && !results && query.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyText}>
                {t('search.placeholder') || 'Search by topic or teacher'}
              </Text>
            </View>
          )}

          {error && (
            <View style={styles.statusContainer}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.burgundy[500]} />
              <Text style={[styles.statusText, { color: colors.burgundy[500] }]}>
                {error}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  searchBarDesktop: {
    paddingHorizontal: 40,
    paddingTop: 36,
    backgroundColor: colors.cream[100],
    borderBottomWidth: 0,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: 4,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: colors.gray[800],
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  clearButton: {
    padding: 4,
  },
  resultsList: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsContentDesktop: {
    paddingHorizontal: 40,
    maxWidth: 800,
  },
  resultsCount: {
    fontSize: 14,
    color: colors.gray[500],
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  statusText: {
    fontSize: 15,
    color: colors.gray[500],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[700],
    marginTop: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.gray[500],
    textAlign: 'center',
  },

  // Result card
  resultCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 20,
    paddingHorizontal: 0,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  resultCardHeader: {
    marginBottom: 10,
  },
  resultCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  resultEventTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[800],
  },
  resultTeachers: {
    fontSize: 14,
    color: colors.burgundy[500],
    marginTop: 4,
    marginLeft: 26,
  },
  resultDate: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 2,
    marginLeft: 26,
  },

  // Snippets — why it matched
  snippetsContainer: {
    gap: 8,
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  snippetRow: {
    gap: 2,
  },
  snippetField: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.burgundy[500],
    textTransform: 'uppercase' as const,
  },
  snippetText: {
    fontSize: 13,
    color: colors.gray[600],
    fontStyle: 'italic',
    lineHeight: 19,
  },

  // Matched tracks
  matchedTracksContainer: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  matchedTracksLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.burgundy[500],
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  matchedTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  matchedTrackText: {
    flex: 1,
    fontSize: 13,
    color: colors.gray[600],
  },
  matchedTracksMore: {
    fontSize: 12,
    color: colors.gray[400],
    paddingLeft: 22,
  },
});
