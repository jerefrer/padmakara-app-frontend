import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router, usePathname, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSidebarNavigation } from '@/contexts/SidebarNavigationContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { colors } from '@/constants/colors';
import { getTranslatedName } from '@/utils/i18n';
import retreatService from '@/services/retreatService';
import { RetreatGroup, Gathering, Session } from '@/types';

interface NavItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  route: string;
  matchPrefix: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const segments = useSegments();
  const { user, isAuthenticated, hasActiveSubscription } = useAuth();
  const { t, language } = useLanguage();
  const { sidebarCollapsed } = useDesktopLayout();
  const {
    level,
    drillDown,
    goBack,
    activeItemId,
    setActiveItem,
    breadcrumbLabel,
    isSidebarNavigation,
  } = useSidebarNavigation();

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredContentItem, setHoveredContentItem] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  // Data states
  const [groups, setGroups] = useState<RetreatGroup[]>([]);
  const [retreats, setRetreats] = useState<Gathering[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  // Route sync: track whether navigation is sidebar-initiated
  const lastSyncedPath = useRef<string>('');

  const navItems: NavItem[] = [
    {
      key: 'home',
      label: t('navigation.retreats') || 'Retreats',
      icon: 'home-outline',
      activeIcon: 'home',
      route: '/(tabs)/(groups)',
      matchPrefix: '/(groups)',
    },
    {
      key: 'events',
      label: t('navigation.events') || 'Events',
      icon: 'calendar-outline',
      activeIcon: 'calendar',
      route: '/(tabs)/(events)',
      matchPrefix: '/(events)',
    },
    {
      key: 'settings',
      label: t('navigation.settings') || 'Settings',
      icon: 'settings-outline',
      activeIcon: 'settings',
      route: '/(tabs)/settings',
      matchPrefix: '/settings',
    },
    {
      key: 'subscription',
      label: t('navigation.subscription') || 'Subscribe',
      icon: 'card-outline',
      activeIcon: 'card',
      route: '/(tabs)/subscription',
      matchPrefix: '/subscription',
    },
  ];

  const isActive = useCallback(
    (item: NavItem): boolean => {
      return pathname.includes(item.matchPrefix);
    },
    [pathname]
  );

  const handleNavPress = useCallback((route: string) => {
    router.push(route as any);
  }, []);

  const getUserInitials = (): string => {
    if (!user?.name) return '?';
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const getUserFirstInitial = (): string => {
    if (!user?.name) return '?';
    return user.name.trim()[0].toUpperCase();
  };

  const getGroupInitial = (group: RetreatGroup): string => {
    const name = getTranslatedName(group, language as 'en' | 'pt');
    return name ? name[0].toUpperCase() : '?';
  };

  const getSubscriptionLabel = (): string => {
    if (!isAuthenticated) return '';
    if (hasActiveSubscription) return t('profile.activeSubscription') || 'Active';
    return t('profile.inactiveSubscription') || 'Inactive';
  };

  // ── Data fetching ──────────────────────────────────────────────────

  // Fetch groups (level 0)
  useEffect(() => {
    if (level.type !== 'groups') return;
    if (!isAuthenticated || !hasActiveSubscription) return;

    let cancelled = false;
    setLoading(true);

    retreatService.getUserRetreats().then((response) => {
      if (cancelled) return;
      if (response.success && response.data) {
        setGroups(response.data.retreat_groups);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [level.type, isAuthenticated, hasActiveSubscription]);

  // Fetch retreats for a group (level 1)
  useEffect(() => {
    if (level.type !== 'retreats' || !level.parentId) return;

    let cancelled = false;
    setLoading(true);

    retreatService.getRetreatGroupDetails(level.parentId).then((response) => {
      if (cancelled) return;
      if (response.success && response.data) {
        setRetreats(response.data.gatherings || []);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [level.type, level.parentId]);

  // Fetch sessions for a retreat (level 2)
  useEffect(() => {
    if (level.type !== 'sessions' || !level.parentId) return;

    let cancelled = false;
    setLoading(true);

    retreatService.getRetreatDetails(level.parentId).then((response) => {
      if (cancelled) return;
      if (response.success && response.data) {
        setSessions(response.data.sessions || []);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [level.type, level.parentId, language]);

  // ── Route synchronization (Task 9) ────────────────────────────────

  useEffect(() => {
    // Skip if navigation was sidebar-initiated
    if (isSidebarNavigation.current) {
      isSidebarNavigation.current = false;
      lastSyncedPath.current = pathname;
      return;
    }

    // Skip if path hasn't changed
    if (pathname === lastSyncedPath.current) return;
    lastSyncedPath.current = pathname;

    // Only sync when on groups routes
    if (!pathname.includes('/(groups)')) return;

    // Parse segments to determine where we are
    // Segments: ["(tabs)", "(groups)", ...rest]
    const groupsIndex = segments.indexOf('(groups)');
    if (groupsIndex === -1) return;

    const rest = segments.slice(groupsIndex + 1);

    if (rest.length === 0 || (rest.length === 1 && rest[0] === 'index')) {
      // At /(groups) or /(groups)/index -> level 0
      if (level.type !== 'groups') {
        // Reset to groups level - reconstruct full stack
        goBack();
        // May need to go back multiple levels
        // Use a timeout to avoid batching issues
      }
    } else if (rest.length === 1 && rest[0] !== 'retreat' && rest[0] !== 'session' && rest[0] !== 'transcript') {
      // At /(groups)/[groupId] -> level 1 (retreats)
      const groupId = rest[0];
      if (level.type !== 'retreats' || level.parentId !== groupId) {
        // We need to find the group name. Check if we have groups loaded.
        const group = groups.find(g => g.id === groupId);
        const groupNameVal = group
          ? getTranslatedName(group, language as 'en' | 'pt')
          : '';
        drillDown('retreats', groupId, groupNameVal || t('groups.yourGroups') || 'Your Groups');
      }
    } else if (rest.length >= 2 && rest[0] === 'retreat') {
      // At /(groups)/retreat/[id] -> level 2 (sessions)
      const retreatId = rest[1];
      if (level.type !== 'sessions' || level.parentId !== retreatId) {
        // Find retreat name from currently loaded retreats
        const retreat = retreats.find(r => r.id === retreatId);
        const retreatNameVal = retreat
          ? getTranslatedName(retreat, language as 'en' | 'pt')
          : '';
        drillDown('sessions', retreatId, retreatNameVal || '');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only reacts to route changes; including other deps would cause infinite sync loops
  }, [pathname, segments]);

  // ── Sidebar navigation handlers ───────────────────────────────────

  const handleGroupPress = useCallback((group: RetreatGroup) => {
    isSidebarNavigation.current = true;
    const name = getTranslatedName(group, language as 'en' | 'pt');
    drillDown('retreats', group.id, name);
    router.push(`/(tabs)/(groups)/${group.id}` as any);
  }, [drillDown, language, isSidebarNavigation]);

  const handleRetreatPress = useCallback((retreat: Gathering) => {
    isSidebarNavigation.current = true;
    const name = getTranslatedName(retreat, language as 'en' | 'pt');
    drillDown('sessions', retreat.id, name);
    router.push(`/(tabs)/(groups)/retreat/${retreat.id}` as any);
  }, [drillDown, language, isSidebarNavigation]);

  const handleSessionPress = useCallback((session: Session) => {
    setActiveItem(session.id);
    // Sessions are shown on the retreat detail page - user is already there.
    // No additional navigation needed.
  }, [setActiveItem]);

  const handleBreadcrumbPress = useCallback(() => {
    isSidebarNavigation.current = true;

    if (level.type === 'retreats') {
      // Going back to groups
      goBack();
      router.push('/(tabs)/(groups)' as any);
    } else if (level.type === 'sessions') {
      // Going back to retreats - we need the group ID from the parent level
      goBack();
      // After goBack, the level will be 'retreats' with the groupId
      // We navigate to the group page
      // But we need the parentId from the retreats level, which is the groupId
      // Since goBack pops the last item, the new top will have parentId = groupId
      // We can't read it synchronously after goBack due to React state batching,
      // so just go back in the router
      router.back();
    }
  }, [level, goBack, isSidebarNavigation]);

  // ── Session formatting helpers ────────────────────────────────────

  const formatSessionLabel = (session: Session): string => {
    const name = getTranslatedName(session, language as 'en' | 'pt');
    const typeLabel = session.type === 'morning'
      ? (t('retreats.morning') || 'Morning')
      : session.type === 'evening'
        ? (t('retreats.evening') || 'Evening')
        : '';

    if (typeLabel && name) {
      return `${typeLabel} - ${name}`;
    }
    return name || typeLabel || session.id;
  };

  const formatSessionDate = (session: Session): string => {
    if (!session.date) return '';
    try {
      const d = new Date(session.date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // ── Render helpers ────────────────────────────────────────────────

  const renderBreadcrumb = () => {
    if (level.type === 'groups') return null;

    const label = level.type === 'retreats'
      ? (t('groups.yourGroups') || 'Your Groups')
      : (breadcrumbLabel || level.parentName || '');

    return (
      <Pressable
        style={styles.breadcrumb}
        onPress={handleBreadcrumbPress}
        accessibilityRole="button"
        accessibilityLabel={`${t('common.goBack') || 'Go back'} to ${label}`}
      >
        <Ionicons name="chevron-back" size={14} color={colors.burgundy[500]} />
        <Text style={styles.breadcrumbText} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const renderContentSection = () => {
    if (!isAuthenticated || !hasActiveSubscription) {
      return (
        <View style={styles.contentSection}>
          <Text style={styles.sectionHeader}>
            {(t('groups.yourGroups') || 'YOUR GROUPS').toUpperCase()}
          </Text>
          <Text style={styles.placeholderText}>
            {t('common.loading') || 'Loading...'}
          </Text>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.contentSection}>
          {renderBreadcrumb()}
          <Text style={styles.sectionHeader}>
            {level.type === 'groups'
              ? (t('groups.yourGroups') || 'YOUR GROUPS').toUpperCase()
              : level.type === 'retreats'
                ? (level.parentName || '').toUpperCase()
                : (level.parentName || '').toUpperCase()
            }
          </Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.burgundy[500]} />
          </View>
        </View>
      );
    }

    if (level.type === 'groups') {
      return renderGroupsList();
    } else if (level.type === 'retreats') {
      return renderRetreatsList();
    } else if (level.type === 'sessions') {
      return renderSessionsList();
    }

    return null;
  };

  const renderGroupsList = () => {
    return (
      <View style={styles.contentSection}>
        <Text style={styles.sectionHeader}>
          {(t('groups.yourGroups') || 'YOUR GROUPS').toUpperCase()}
        </Text>
        <ScrollView style={styles.contentScrollView} showsVerticalScrollIndicator={false}>
          {groups.map((group) => {
            const isItemActive = activeItemId === group.id;
            const isHoveredItem = hoveredContentItem === `group-${group.id}`;

            return (
              <Pressable
                key={group.id}
                style={[
                  styles.contentItem,
                  isItemActive && styles.contentItemActive,
                  isHoveredItem && !isItemActive && styles.contentItemHover,
                ]}
                onPress={() => handleGroupPress(group)}
                // @ts-ignore -- web-only mouse events
                onMouseEnter={() => setHoveredContentItem(`group-${group.id}`)}
                // @ts-ignore
                onMouseLeave={() => setHoveredContentItem(null)}
                accessibilityRole="button"
                accessibilityLabel={getTranslatedName(group, language as 'en' | 'pt')}
              >
                <Ionicons
                  name="people-outline"
                  size={16}
                  color={isItemActive ? colors.burgundy[500] : colors.gray[500]}
                  style={styles.contentItemIcon}
                />
                <Text
                  style={[
                    styles.contentItemText,
                    isItemActive && styles.contentItemTextActive,
                  ]}
                  numberOfLines={2}
                >
                  {getTranslatedName(group, language as 'en' | 'pt')}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderRetreatsList = () => {
    // Sort retreats by date, newest first
    const sorted = [...retreats].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );

    // Group by year
    const byYear = sorted.reduce((acc, retreat) => {
      const year = retreat.year || new Date(retreat.startDate).getFullYear();
      if (!acc[year]) acc[year] = [];
      acc[year].push(retreat);
      return acc;
    }, {} as Record<number, Gathering[]>);

    const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

    return (
      <View style={styles.contentSection}>
        {renderBreadcrumb()}
        <Text style={styles.sectionHeader}>
          {(level.parentName || '').toUpperCase()}
        </Text>
        <ScrollView style={styles.contentScrollView} showsVerticalScrollIndicator={false}>
          {years.map((year) => (
            <View key={year}>
              <Text style={styles.yearHeader}>{year}</Text>
              {byYear[year].map((retreat) => {
                const isItemActive = activeItemId === retreat.id;
                const isHoveredItem = hoveredContentItem === `retreat-${retreat.id}`;

                return (
                  <Pressable
                    key={retreat.id}
                    style={[
                      styles.contentItem,
                      isItemActive && styles.contentItemActive,
                      isHoveredItem && !isItemActive && styles.contentItemHover,
                    ]}
                    onPress={() => handleRetreatPress(retreat)}
                    // @ts-ignore
                    onMouseEnter={() => setHoveredContentItem(`retreat-${retreat.id}`)}
                    // @ts-ignore
                    onMouseLeave={() => setHoveredContentItem(null)}
                    accessibilityRole="button"
                    accessibilityLabel={getTranslatedName(retreat, language as 'en' | 'pt')}
                  >
                    <Text
                      style={[
                        styles.contentItemText,
                        isItemActive && styles.contentItemTextActive,
                      ]}
                      numberOfLines={2}
                    >
                      {getTranslatedName(retreat, language as 'en' | 'pt')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSessionsList = () => {
    // Sort sessions by date then by type (morning first)
    const sorted = [...sessions].sort((a, b) => {
      const dateCmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCmp !== 0) return dateCmp;
      // Morning before evening
      if (a.type === 'morning' && b.type !== 'morning') return -1;
      if (a.type !== 'morning' && b.type === 'morning') return 1;
      return 0;
    });

    // Group by date for day headers
    let lastDate = '';

    return (
      <View style={styles.contentSection}>
        {renderBreadcrumb()}
        <Text style={styles.sectionHeader}>
          {(level.parentName || '').toUpperCase()}
        </Text>
        <ScrollView style={styles.contentScrollView} showsVerticalScrollIndicator={false}>
          {sorted.map((session) => {
            const isItemActive = activeItemId === session.id;
            const isHoveredItem = hoveredContentItem === `session-${session.id}`;
            const dateStr = formatSessionDate(session);
            const showDateHeader = dateStr !== lastDate;
            lastDate = dateStr;

            return (
              <View key={session.id}>
                {showDateHeader && dateStr && (
                  <Text style={styles.dateHeader}>{dateStr}</Text>
                )}
                <Pressable
                  style={[
                    styles.contentItem,
                    isItemActive && styles.contentItemActive,
                    isHoveredItem && !isItemActive && styles.contentItemHover,
                  ]}
                  onPress={() => handleSessionPress(session)}
                  // @ts-ignore
                  onMouseEnter={() => setHoveredContentItem(`session-${session.id}`)}
                  // @ts-ignore
                  onMouseLeave={() => setHoveredContentItem(null)}
                  accessibilityRole="button"
                  accessibilityLabel={formatSessionLabel(session)}
                >
                  <Text
                    style={[
                      styles.contentItemText,
                      isItemActive && styles.contentItemTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {formatSessionLabel(session)}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ── Collapsed rail (tablet) ───────────────────────────────────────

  const renderCollapsedRail = () => {
    return (
      <View
        style={styles.railContainer}
        // @ts-ignore -- web-only mouse events
        onMouseEnter={() => setHovered(true)}
        // @ts-ignore
        onMouseLeave={() => setHovered(false)}
      >
        {/* Logo icon only */}
        <Pressable
          style={styles.railLogoSection}
          onPress={() => handleNavPress('/(tabs)/(groups)')}
          accessibilityRole="link"
          accessibilityLabel="Padmakara home"
        >
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.railLogo}
            resizeMode="contain"
          />
        </Pressable>

        {/* Nav icons */}
        <View style={styles.railNavSection}>
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.railNavItem,
                  active && styles.railNavItemActive,
                ]}
                onPress={() => handleNavPress(item.route)}
                accessibilityRole="link"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={active ? item.activeIcon : item.icon}
                  size={22}
                  color={active ? colors.burgundy[500] : colors.gray[500]}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Divider */}
        <View style={styles.railDivider} />

        {/* Group initials */}
        <View style={styles.railContentSection}>
          {groups.map((group) => {
            const isItemActive = activeItemId === group.id;
            return (
              <Pressable
                key={group.id}
                style={[
                  styles.railGroupItem,
                  isItemActive && styles.railGroupItemActive,
                ]}
                onPress={() => handleGroupPress(group)}
                accessibilityRole="button"
                accessibilityLabel={getTranslatedName(group, language as 'en' | 'pt')}
              >
                <Text
                  style={[
                    styles.railGroupInitial,
                    isItemActive && styles.railGroupInitialActive,
                  ]}
                >
                  {getGroupInitial(group)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* User initial at bottom */}
        <View style={styles.railUserFooter}>
          <View style={styles.railDivider} />
          {isAuthenticated && user ? (
            <Pressable
              style={styles.railUserButton}
              onPress={() => handleNavPress('/(tabs)/settings')}
              accessibilityRole="link"
              accessibilityLabel={user.name || 'User'}
            >
              <View style={styles.railAvatar}>
                <Text style={styles.railAvatarText}>{getUserFirstInitial()}</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              style={styles.railUserButton}
              onPress={() => router.push('/(auth)/magic-link' as any)}
              accessibilityRole="link"
              accessibilityLabel="Sign in"
            >
              <View style={styles.railAvatar}>
                <Ionicons name="person-outline" size={14} color={colors.white} />
              </View>
            </Pressable>
          )}
        </View>

        {/* Hover expansion overlay */}
        {hovered && (
          <View
            style={styles.hoverOverlay}
            // @ts-ignore -- web-only mouse events
            onMouseEnter={() => setHovered(true)}
            // @ts-ignore
            onMouseLeave={() => setHovered(false)}
          >
            {renderFullSidebar()}
          </View>
        )}
      </View>
    );
  };

  // ── Full sidebar content (shared between default and hover overlay) ─

  const renderFullSidebar = () => {
    return (
      <View style={styles.container}>
        {/* Logo and app name */}
        <View style={styles.logoSection}>
          <Pressable
            style={styles.logoRow}
            onPress={() => handleNavPress('/(tabs)/(groups)')}
            accessibilityRole="link"
            accessibilityLabel="Padmakara home"
          >
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Padmakara</Text>
          </Pressable>
          <Pressable
            style={styles.collapseButton}
            accessibilityRole="button"
            accessibilityLabel="Collapse sidebar"
          >
            <Ionicons name="chevron-back-outline" size={16} color={colors.gray[400]} />
          </Pressable>
        </View>

        {/* Navigation items */}
        <View style={styles.navSection}>
          {navItems.map((item) => {
            const active = isActive(item);
            const isHoveredNav = hoveredItem === item.key;

            return (
              <Pressable
                key={item.key}
                style={[
                  styles.navItem,
                  active && styles.navItemActive,
                  isHoveredNav && !active && styles.navItemHover,
                ]}
                onPress={() => handleNavPress(item.route)}
                // @ts-ignore -- web-only mouse events
                onMouseEnter={() => setHoveredItem(item.key)}
                // @ts-ignore
                onMouseLeave={() => setHoveredItem(null)}
                accessibilityRole="link"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={active ? item.activeIcon : item.icon}
                  size={20}
                  color={active ? colors.burgundy[500] : colors.gray[500]}
                />
                <Text
                  style={[
                    styles.navLabel,
                    active && styles.navLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Content section: drill-down navigation */}
        {renderContentSection()}

        {/* User footer */}
        <View style={styles.userFooter}>
          <View style={styles.footerDivider} />
          {isAuthenticated && user ? (
            <Pressable
              style={styles.userRow}
              onPress={() => handleNavPress('/(tabs)/settings')}
              accessibilityRole="link"
              accessibilityLabel={`${user.name}, ${getSubscriptionLabel()}`}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getUserInitials()}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user.dharma_name || user.name}
                </Text>
                <Text style={styles.userStatus} numberOfLines={1}>
                  {getSubscriptionLabel()}
                </Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              style={styles.userRow}
              onPress={() => router.push('/(auth)/magic-link' as any)}
              accessibilityRole="link"
              accessibilityLabel="Sign in"
            >
              <View style={styles.avatar}>
                <Ionicons name="person-outline" size={16} color={colors.white} />
              </View>
              <Text style={styles.signInText}>
                {t('common.login') || 'Sign In'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  // ── Main render ───────────────────────────────────────────────────

  if (sidebarCollapsed) {
    return renderCollapsedRail();
  }

  return renderFullSidebar();
}

const styles = StyleSheet.create({
  // ── Full sidebar styles ─────────────────────────────────────────
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.white,
  },

  /* Logo section */
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  appName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.burgundy[500],
    letterSpacing: 0.3,
  },
  collapseButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Navigation */
  navSection: {
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: colors.cream[100],
    borderLeftColor: colors.burgundy[500],
  },
  navItemHover: {
    backgroundColor: colors.cream[50],
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray[600],
    marginLeft: 12,
  },
  navLabelActive: {
    color: colors.burgundy[500],
    fontWeight: '600',
  },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginHorizontal: 16,
    marginTop: 12,
  },

  /* Content section */
  contentSection: {
    paddingHorizontal: 8,
    marginTop: 16,
    flex: 1,
  },
  contentScrollView: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray[500],
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  placeholderText: {
    fontSize: 13,
    color: colors.gray[400],
    paddingHorizontal: 8,
  },

  /* Breadcrumb */
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  breadcrumbText: {
    fontSize: 13,
    color: colors.burgundy[500],
    fontWeight: '500',
    marginLeft: 2,
    flex: 1,
  },

  /* Content items */
  contentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    marginBottom: 1,
  },
  contentItemActive: {
    backgroundColor: colors.cream[100],
    borderLeftColor: colors.burgundy[500],
  },
  contentItemHover: {
    backgroundColor: colors.cream[50],
  },
  contentItemIcon: {
    marginRight: 8,
  },
  contentItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray[700],
    flex: 1,
  },
  contentItemTextActive: {
    color: colors.burgundy[500],
    fontWeight: '600',
  },

  /* Year header (retreats level) */
  yearHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray[500],
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 16,
  },

  /* Date header (sessions level) */
  dateHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray[500],
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 16,
  },

  /* Loading */
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },

  /* User footer */
  userFooter: {
    marginTop: 'auto',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  footerDivider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginBottom: 12,
    marginHorizontal: 4,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.burgundy[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  userInfo: {
    marginLeft: 10,
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray[700],
  },
  userStatus: {
    fontSize: 11,
    color: colors.gray[400],
    marginTop: 1,
  },
  signInText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.burgundy[500],
    marginLeft: 10,
  },

  // ── Collapsed rail styles (tablet) ──────────────────────────────
  railContainer: {
    width: 64,
    flex: 1,
    backgroundColor: colors.white,
    borderRightWidth: 1,
    borderRightColor: colors.gray[200],
    alignItems: 'center',
    paddingVertical: 12,
  },

  railLogoSection: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  railLogo: {
    width: 28,
    height: 28,
  },

  railNavSection: {
    width: '100%',
    alignItems: 'center',
    gap: 2,
  },
  railNavItem: {
    width: 48,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  railNavItemActive: {
    backgroundColor: colors.cream[100],
    borderLeftColor: colors.burgundy[500],
  },

  railDivider: {
    width: 32,
    height: 1,
    backgroundColor: colors.gray[200],
    marginVertical: 10,
  },

  railContentSection: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  railGroupItem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cream[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  railGroupItemActive: {
    backgroundColor: colors.burgundy[50],
    borderWidth: 2,
    borderColor: colors.burgundy[500],
  },
  railGroupInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[600],
  },
  railGroupInitialActive: {
    color: colors.burgundy[500],
  },

  railUserFooter: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 4,
  },
  railUserButton: {
    padding: 4,
  },
  railAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.burgundy[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  railAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },

  // ── Hover overlay (expanded sidebar over collapsed rail) ────────
  hoverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 240,
    bottom: 0,
    backgroundColor: colors.white,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderRightWidth: 1,
    borderRightColor: colors.gray[200],
  },
});
