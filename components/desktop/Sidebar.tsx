import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { router, usePathname, useSegments, useGlobalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors } from '@/constants/colors';

export function Sidebar() {
  const pathname = usePathname();
  const segments = useSegments();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const globalParams = useGlobalSearchParams<{ code?: string; teacher?: string; from?: string }>();
  const fromParam = globalParams.from as string | undefined;
  const isInEventsSection = pathname.includes('/events') || pathname.includes('/teacher/')
    || (fromParam === 'events' && (pathname.includes('/retreat/') || pathname.includes('/session/')));

  // ── Navigation items ────────────────────────────────────────────────

  const categories = [
    {
      key: 'whats-new',
      title: t('home.whatsNew') || "What's New",
      subtitle: t('home.whatsNewSubtitle') || 'Featured content and recent additions',
      route: '/(tabs)/(groups)',
    },
    {
      key: 'events',
      title: t('home.teachingsAndTalks') || 'Teachings & Talks',
      subtitle: t('home.teachingsSubtitle') || 'Events by Kangyur Rinpoche Found., Songtsen Pt & others',
      route: '/(tabs)/(groups)/events',
    },
    {
      key: 'home',
      title: t('home.retreats') || 'Retreats',
      subtitle: t('home.retreatsSubtitle') || 'Organized by Kangyur Rinpoche Foundation',
      route: '/(tabs)/(groups)/retreats',
    },
    {
      key: 'publications',
      title: t('home.publications') || 'Publications',
      subtitle: t('home.publicationsSubtitle') || 'By Padmakara in Portuguese Language',
      route: '/(tabs)/(groups)/publications',
    },
  ];

  const isActive = useCallback(
    (key: string): boolean => {
      const segs = segments as string[];
      if (key === 'events') {
        return segs.includes('(groups)') && isInEventsSection;
      }
      if (key === 'publications') {
        return segs.includes('(groups)') && pathname.includes('/publications');
      }
      if (key === 'home') {
        return segs.includes('(groups)')
          && !isInEventsSection
          && !pathname.includes('/publications')
          && (pathname.includes('/retreats') || !!globalParams.code || pathname.includes('/retreat/') || pathname.includes('/session/'));
      }
      if (key === 'whats-new') {
        return segs.includes('(groups)')
          && !isInEventsSection
          && !pathname.includes('/publications')
          && !pathname.includes('/retreats')
          && !pathname.includes('/retreat/')
          && !pathname.includes('/session/')
          && !pathname.includes('/transcript/')
          && !globalParams.code;
      }
      if (key === 'search') {
        return segs.includes('search');
      }
      return false;
    },
    [segments, pathname, isInEventsSection, globalParams.code]
  );

  const handleNavPress = useCallback((route: string, key: string) => {
    if (isActive(key)) {
      router.replace(route as any);
    } else {
      router.push(route as any);
    }
  }, [isActive]);

  const handleRetreatsPress = useCallback(() => {
    if (!isAuthenticated) {
      router.push({ pathname: '/(auth)/magic-link', params: { returnTo: '/(tabs)/(groups)' } } as any);
      return;
    }
    if (isActive('home')) {
      router.replace('/(tabs)/(groups)/retreats' as any);
    } else {
      router.push('/(tabs)/(groups)/retreats' as any);
    }
  }, [isAuthenticated, isActive]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.navSection}>
          {categories.map((cat) => {
            const active = isActive(cat.key);
            const isHovered = hoveredItem === cat.key;

            return (
              <Pressable
                key={cat.key}
                style={[
                  styles.categoryRow,
                  active && styles.categoryRowActive,
                  isHovered && !active && styles.categoryRowHover,
                ]}
                onPress={() => cat.key === 'home' ? handleRetreatsPress() : handleNavPress(cat.route, cat.key)}
                // @ts-ignore
                onMouseEnter={() => setHoveredItem(cat.key)}
                // @ts-ignore
                onMouseLeave={() => setHoveredItem(null)}
                accessibilityRole="link"
                accessibilityLabel={cat.title}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.categoryTitle, active && styles.categoryTitleActive]}>
                  {cat.title}
                </Text>
                <Text style={[styles.categorySubtitle, active && styles.categorySubtitleActive]}>
                  {cat.subtitle}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Search — styled as a category for visual consistency */}
      <View style={styles.bottomSection}>
        <Pressable
          style={[
            styles.categoryRow,
            styles.searchCategoryRow,
            isActive('search') && styles.categoryRowActive,
            hoveredItem === 'search' && !isActive('search') && styles.categoryRowHover,
          ]}
          onPress={() => handleNavPress('/(tabs)/search', 'search')}
          // @ts-ignore
          onMouseEnter={() => setHoveredItem('search')}
          // @ts-ignore
          onMouseLeave={() => setHoveredItem(null)}
          accessibilityRole="link"
          accessibilityLabel={t('navigation.search') || 'Search'}
          accessibilityState={{ selected: isActive('search') }}
        >
          <Text style={[styles.categoryTitle, isActive('search') && styles.categoryTitleActive]}>
            {t('navigation.search') || 'Search'}
          </Text>
          <Text style={[styles.categorySubtitle, isActive('search') && styles.categorySubtitleActive]}>
            {t('search.sidebarSubtitle') || 'Find by topic, teacher, or word'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.white,
  },
  scrollView: {
    flex: 1,
  },

  /* Category navigation */
  navSection: {
    paddingTop: 32,
    paddingHorizontal: 20,
  },
  categoryRow: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  categoryRowActive: {
    borderLeftWidth: 3,
    borderLeftColor: colors.burgundy[500],
    paddingLeft: 12,
    backgroundColor: colors.burgundy[50],
  },
  categoryRowHover: {
    backgroundColor: '#faf9f8',
  },
  categoryTitle: {
    fontSize: 22,
    fontFamily: 'MinionPro',
    color: colors.gray[800],
    fontVariant: ['small-caps'],
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  categoryTitleActive: {
    color: colors.burgundy[500],
  },
  categorySubtitle: {
    fontSize: 12,
    fontFamily: 'Avenir',
    color: colors.gray[500],
    letterSpacing: 0.3,
  },
  categorySubtitleActive: {
    color: colors.burgundy[500],
    opacity: 0.7,
  },

  /* Search at bottom — matches category typography */
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchCategoryRow: {
    // The search row is the last item; drop the bottom hairline since
    // there is nothing visually following it.
    borderBottomWidth: 0,
  },
});
