import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { Image } from 'expo-image';
import { AppHeader } from '@/components/ui/AppHeader';
import { useLanguage } from '@/contexts/LanguageContext';
import retreatService from '@/services/retreatService';

const colors = {
  cream: {
    50: '#fefdfb',
    100: '#fcf8f3',
  },
  burgundy: {
    50: '#fef2f2',
    500: '#b91c1c',
  },
  gray: {
    500: '#6b7280',
    600: '#4b5563',
  },
};

interface PublicEventCardProps {
  event: any;
  onPress: () => void;
  language: string;
}

function PublicEventCard({ event, onPress, language }: PublicEventCardProps) {
  // Data comes through mapEvent() which produces name/name_translations
  const title = (language === 'pt' && event.name_translations?.pt)
    ? event.name_translations.pt
    : event.name || event.name_translations?.en || '';
  const sessionCount = event.sessions?.length || 0;

  // Format date nicely
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.groupCard}>
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.groupTitle}>{title}</Text>
          {event.startDate && (
            <Text style={styles.eventDate}>{formatDate(event.startDate)}</Text>
          )}
          <Text style={styles.retreatsText}>
            {sessionCount === 1 ? '1 session' : `${sessionCount} sessions`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function EventsScreen() {
  const { t, language } = useLanguage();
  const [publicEvents, setPublicEvents] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await retreatService.getPublicEvents();
      if (response.success && response.data) {
        setPublicEvents(response.data);
      } else if (response.error?.includes('404')) {
        // Endpoint not available yet — show empty state instead of error
        setPublicEvents([]);
      } else {
        setError(response.error || 'Failed to load events');
      }
    } catch (err) {
      console.error('Error loading public events:', err);
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleEventPress = (eventId: number) => {
    router.push(`/(tabs)/(events)/event/${eventId}`);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, header: () => <AppHeader /> }} />
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.burgundy[500]} />
            <Text style={styles.loadingText}>
              {t('common.loading') || 'Loading...'}
            </Text>
          </View>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, header: () => <AppHeader /> }} />
        <View style={styles.container}>
          <View style={styles.emptyState}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.emptyLogo}
              contentFit="contain"
            />
            <Text style={styles.emptyTitle}>
              {t('common.connectionError') || 'Connection Error'}
            </Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadEvents}>
              <Text style={styles.retryButtonText}>{t('common.retry') || 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, header: () => <AppHeader /> }} />
      <View style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('groups.publicEvents') || 'Public Events'}</Text>
          </View>

          {publicEvents && publicEvents.length > 0 ? (
            publicEvents.map((event: any) => (
              <PublicEventCard
                key={event.id}
                event={event}
                onPress={() => handleEventPress(event.id)}
                language={language}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {t('groups.noPublicEvents') || 'No public events available at this time.'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyLogo: {
    width: 64,
    height: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
  },
  header: {
    paddingTop: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.burgundy[500],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groupCard: {
    marginBottom: 16,
  },
  cardContent: {},
  groupTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 14,
    color: colors.gray[500],
    marginBottom: 4,
  },
  retreatsText: {
    fontSize: 14,
    color: colors.gray[600],
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
  retryButton: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
