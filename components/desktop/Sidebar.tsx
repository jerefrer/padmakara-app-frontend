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
import { DESKTOP_LINE_RIGHT_GAP, RULE_COLOR } from '@/constants/layout';
import { Hairline } from '@/components/ui/Hairline';

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
      // The phone tab bar's house, so Home looks the same on both layouts.
      icon: 'home-outline' as const,
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
      title: t('home.retreats') || 'Personal Library',
      subtitle: t('home.retreatsSubtitle') || 'Your audio, videos and transcriptions (registration required)',
      route: '/(tabs)/(groups)/retreats',
      // One person: the library is the reader's own (André).
      icon: 'person-outline' as const,
      shortTitle: t('navigation.retreats') || 'Personal Library',
    },
    {
      key: 'publications',
      title: t('home.publications') || 'Publications',
      subtitle: t('home.publicationsSubtitle') || 'By Padmakara in Portuguese Language',
      route: '/(tabs)/(groups)/publications',
      icon: 'book-outline' as const,
      shortTitle: t('home.publications') || 'Publications',
    },
    // Search has a subtitle like the entries above it, so it belongs in the main list (André).
    {
      key: 'search',
      title: t('navigation.search') || 'Search',
      subtitle: t('search.sidebarSubtitle') || 'Find by topic, teacher, or word',
      route: '/(tabs)/search',
      icon: 'search-outline' as const,
      shortTitle: t('navigation.search') || 'Search',
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

  // Bottom entry: the bookmarks, kept apart from the main list (André). On the full sidebar
  // the account is reached from the right panel (the user's name, or Login when signed out).
  const bottomItems = [
    {
      key: 'bookmarks',
      title: t('navigation.myBookmarks') || 'My Bookmarks',
      subtitle: null,
      route: '/(tabs)/bookmarks',
      icon: 'bookmark-outline' as const,
      shortTitle: t('navigation.bookmarks') || 'Bookmarks',
    },
  ];

  // The iPad rail has no right panel, so it keeps its own Account entry.
  const accountItem = {
    key: 'settings',
    title: t('navigation.account') || 'Account',
    subtitle: null,
    route: '/(tabs)/settings',
    icon: 'person-circle-outline' as const,
    shortTitle: t('navigation.account') || 'Account',
  };

  if (compactSidebar) {
    // Touch rail: icon over a short label, every item a 56pt+ target.
    const railItems = [...categories, ...bottomItems, accountItem];
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
                {cat.subtitle ? (
                  <Text style={[styles.categorySubtitle, active && styles.categorySubtitleActive]}>
                    {cat.subtitle}
                  </Text>
                ) : null}
                <Hairline color={RULE_COLOR} testID="sidebar-hairline" />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Bookmarks — styled as the categories for visual consistency */}
      <View style={styles.bottomSection}>
        {bottomItems.map((item, index) => {
          const active = isActive(item.key);
          const isLast = index === bottomItems.length - 1;
          return (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.categoryRow,
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
              {/* The last row has nothing visually following it, so no bottom hairline. */}
              {!isLast && <Hairline color={RULE_COLOR} testID="sidebar-hairline" />}
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
  },
  // A red hairline (Hairline, the thinnest the screen draws) runs under each item to the
  // sidebar's left edge; the text keeps its inset.
  categoryRow: {
    paddingVertical: 16,
    paddingLeft: 20,
    marginRight: DESKTOP_LINE_RIGHT_GAP,
  },
  // The selected item only greys out: its title shows as the page header.
  categoryRowActive: {},
  categoryRowHover: {
    backgroundColor: '#faf9f8',
  },
  categoryTitle: {
    fontSize: 22,
    fontFamily: 'MinionPro',
    color: colors.gray[800],
    fontVariant: ['small-caps'],
    letterSpacing: 0.5,
    // Pulls the subtitle up: the gap under the title was 30% too large (André).
    marginBottom: -1,
  },
  categoryTitleActive: {
    color: colors.gray[400],
  },
  categorySubtitle: {
    fontSize: 12,
    fontFamily: AVENIR_FAMILY,
    color: colors.gray[500],
    letterSpacing: 0.3,
  },
  categorySubtitleActive: {
    color: colors.gray[400],
  },

  /* Search at bottom — matches category typography */
  bottomSection: {
    paddingBottom: 12,
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
