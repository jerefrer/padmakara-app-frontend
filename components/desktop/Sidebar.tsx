import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname, useSegments, useGlobalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSignIn } from '@/components/auth/SignInProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors } from '@/constants/colors';
import { AVENIR_FAMILY } from '@/constants/avenirFont';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';

export function Sidebar() {
  const pathname = usePathname();
  const segments = useSegments();
  const { isAuthenticated } = useAuth();
  const { openSignIn } = useSignIn();
  const { t } = useLanguage();
  const { compactSidebar } = useDesktopLayout();

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
      icon: 'sparkles-outline' as const,
      shortTitle: t('navigation.home') || 'Home',
    },
    {
      key: 'events',
      title: t('home.teachingsAndTalks') || 'Teachings & Talks',
      subtitle: t('home.teachingsSubtitle') || 'Events by Kangyur Rinpoche Found., Songtsen Pt & others',
      route: '/(tabs)/(groups)/events',
      icon: 'mic-outline' as const,
      shortTitle: t('navigation.events') || 'Events',
    },
    {
      key: 'home',
      title: t('home.retreats') || 'Retreats',
      subtitle: t('home.retreatsSubtitle') || 'Organized by Kangyur Rinpoche Foundation',
      route: '/(tabs)/(groups)/retreats',
      icon: 'people-outline' as const,
      shortTitle: t('navigation.retreats') || 'Retreats',
    },
    {
      key: 'publications',
      title: t('home.publications') || 'Publications',
      subtitle: t('home.publicationsSubtitle') || 'By Padmakara in Portuguese Language',
      route: '/(tabs)/(groups)/publications',
      icon: 'book-outline' as const,
      shortTitle: t('home.publications') || 'Publications',
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
      if (key === 'bookmarks') {
        return segs.includes('bookmarks');
      }
      if (key === 'settings') {
        return segs.includes('settings');
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
      openSignIn({ returnTo: '/(tabs)/(groups)' });
      return;
    }
    if (isActive('home')) {
      router.replace('/(tabs)/(groups)/retreats' as any);
    } else {
      router.push('/(tabs)/(groups)/retreats' as any);
    }
  }, [isAuthenticated, isActive]);

  // Bottom entries: search, bookmarks and account settings. Bookmarks used to
  // be unreachable from the sidebar layout.
  const bottomItems = [
    {
      key: 'search',
      title: t('navigation.search') || 'Search',
      subtitle: t('search.sidebarSubtitle') || 'Find by topic, teacher, or word',
      route: '/(tabs)/search',
      icon: 'search-outline' as const,
      shortTitle: t('navigation.search') || 'Search',
    },
    {
      key: 'bookmarks',
      title: t('navigation.bookmarks') || 'Bookmarks',
      subtitle: null,
      route: '/(tabs)/bookmarks',
      icon: 'bookmark-outline' as const,
      shortTitle: t('navigation.bookmarks') || 'Bookmarks',
    },
    {
      key: 'settings',
      title: t('navigation.account') || 'Account',
      subtitle: null,
      route: '/(tabs)/settings',
      icon: 'person-circle-outline' as const,
      shortTitle: t('navigation.account') || 'Account',
    },
  ];

  if (compactSidebar) {
    // Touch rail: icon over a short label, every item a 56pt+ target.
    const railItems = [...categories, ...bottomItems];
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.railContent}
          showsVerticalScrollIndicator={false}
        >
          {railItems.map((item) => {
            const active = isActive(item.key);
            return (
              <Pressable
                key={item.key}
                style={({ pressed }) => [
                  styles.railItem,
                  active && styles.railItemActive,
                  pressed && !active && styles.categoryRowPressed,
                ]}
                onPress={() =>
                  item.key === 'home' ? handleRetreatsPress() : handleNavPress(item.route, item.key)
                }
                accessibilityRole="link"
                accessibilityLabel={item.title}
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={item.icon}
                  size={24}
                  color={active ? colors.burgundy[500] : colors.gray[600]}
                />
                <Text
                  style={[styles.railLabel, active && styles.railLabelActive]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {item.shortTitle}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

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
                style={({ pressed }) => [
                  styles.categoryRow,
                  active && styles.categoryRowActive,
                  (isHovered || pressed) && !active && styles.categoryRowHover,
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

      {/* Search, bookmarks, account — styled as categories for visual consistency */}
      <View style={styles.bottomSection}>
        {bottomItems.map((item, index) => {
          const active = isActive(item.key);
          const isLast = index === bottomItems.length - 1;
          return (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.categoryRow,
                isLast && styles.lastCategoryRow,
                active && styles.categoryRowActive,
                (hoveredItem === item.key || pressed) && !active && styles.categoryRowHover,
              ]}
              onPress={() => handleNavPress(item.route, item.key)}
              // @ts-ignore
              onMouseEnter={() => setHoveredItem(item.key)}
              // @ts-ignore
              onMouseLeave={() => setHoveredItem(null)}
              accessibilityRole="link"
              accessibilityLabel={item.title}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.categoryTitle, active && styles.categoryTitleActive]}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text style={[styles.categorySubtitle, active && styles.categorySubtitleActive]}>
                  {item.subtitle}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
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
    fontFamily: AVENIR_FAMILY,
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
  lastCategoryRow: {
    // The last row has nothing visually following it, so no bottom hairline.
    borderBottomWidth: 0,
  },
  categoryRowPressed: {
    backgroundColor: colors.gray[100],
  },

  /* Compact icon rail (tablet) */
  railContent: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  railItem: {
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railItemActive: {
    backgroundColor: colors.burgundy[50],
  },
  railLabel: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 12,
    fontFamily: AVENIR_FAMILY,
    color: colors.gray[600],
    textAlign: 'center',
  },
  railLabelActive: {
    color: colors.burgundy[500],
    fontWeight: '600',
  },
});
