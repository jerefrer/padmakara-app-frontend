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
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  testID,
}: {
  result: SearchResultEvent;
  language: string;
  t: (key: string) => string;
  onSessionPress: (eventId: number) => void;
  testID?: string;
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
        { month: 'long', day: 'numeric', year: 'numeric' },
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

  // First snippet provides the most relevant matching context
  const primarySnippet = result.snippets?.[0];

  return (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => onSessionPress(result.event.id)}
      activeOpacity={0.7}
      testID={testID}
    >
      <Text style={styles.resultEventTitle} numberOfLines={2}>
        {eventTitle}
      </Text>

      {result.event.teachers.length > 0 && (
        <Text style={styles.resultTeachers} numberOfLines={1}>
          {result.event.teachers.join(', ')}
        </Text>
      )}

      {result.event.startDate && (
        <Text style={styles.resultDate}>{formatDate(result.event.startDate)}</Text>
      )}

      {primarySnippet && (
        <Text style={styles.resultSnippet} numberOfLines={2}>
          {primarySnippet.field !== 'title' && (
            <Text style={styles.resultSnippetField}>
              {(t(FIELD_LABEL_MAP[primarySnippet.field] || primarySnippet.field) || primarySnippet.field) + ' — '}
            </Text>
          )}
          {`“${primarySnippet.text}”`}
        </Text>
      )}

      {allMatchedTracks.length > 0 && (
        <Text style={styles.resultTracksLine} numberOfLines={2}>
          <Text style={styles.resultTracksLabel}>
            {(t('search.matchedTracks') || 'Matching tracks') + ' · '}
          </Text>
          {allMatchedTracks.slice(0, 3).join(' · ')}
          {allMatchedTracks.length > 3 ? `  +${allMatchedTracks.length - 3}` : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const { t, language } = useLanguage();
  const { isDesktop } = useDesktopLayout();
  const insets = useSafeAreaInsets();
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
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
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
              testID="search-input"
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
                  testID={`search-result-${result.event.id}`}
                />
              ))}
            </>
          )}

          {!loading && !results && query.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {t('search.initialPrompt') || 'Search the teachings'}
              </Text>
              <Text style={styles.emptyText}>
                {t('search.initialHint') ||
                  "Type a teacher's name, a topic, or any word from a track title."}
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
    backgroundColor: colors.white,
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
    // Vertically centers the input on the sidebar's "What's New" title.
    paddingTop: 42,
    backgroundColor: colors.white,
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
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
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
    fontSize: 12,
    fontFamily: 'Avenir',
    color: colors.gray[500],
    letterSpacing: 0.3,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
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
    alignSelf: 'center',
    maxWidth: 480,
    paddingVertical: 64,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'EBGaramond_500Medium',
    color: colors.gray[700],
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'EBGaramond_400Regular',
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 22,
  },

  // Result card — typography mirrors the Recently Added cards on Home
  resultCard: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  resultEventTitle: {
    fontSize: 18,
    fontFamily: 'EBGaramond_500Medium',
    color: colors.burgundy[500],
    marginBottom: 2,
  },
  resultTeachers: {
    fontSize: 15,
    fontFamily: 'EBGaramond_400Regular',
    color: colors.gray[800],
    marginBottom: 2,
  },
  resultDate: {
    fontSize: 12,
    fontFamily: 'Avenir',
    color: colors.gray[500],
    letterSpacing: 0.2,
  },
  resultSnippet: {
    fontSize: 13,
    fontFamily: 'EBGaramond_400Regular_Italic',
    color: colors.gray[600],
    lineHeight: 19,
    marginTop: 8,
  },
  resultSnippetField: {
    fontFamily: 'Avenir',
    fontStyle: 'normal',
    color: colors.gray[500],
    letterSpacing: 0.2,
  },
  resultTracksLine: {
    fontSize: 12,
    fontFamily: 'Avenir',
    color: colors.gray[500],
    letterSpacing: 0.2,
    marginTop: 6,
    lineHeight: 18,
  },
  resultTracksLabel: {
    fontFamily: 'Avenir',
    color: colors.gray[700],
    fontWeight: '600',
  },
});
