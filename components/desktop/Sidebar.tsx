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
import { router, usePathname, useSegments, useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors } from '@/constants/colors';
import { getTranslatedName } from '@/utils/i18n';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import retreatService from '@/services/retreatService';
import { RetreatGroup } from '@/types';

interface NavItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  route: string;
  segment: string; // The tab segment name to match against
}

export function Sidebar() {
  const pathname = usePathname();
  const segments = useSegments();
  const { user, isAuthenticated, hasActiveSubscription, logout } = useAuth();
  const { clearTrack } = useAudioPlayerContext();
  const { t, language } = useLanguage();

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredGroupItem, setHoveredGroupItem] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);

  // Data states
  const [groups, setGroups] = useState<RetreatGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // Track active group from URL using global search params (actual values, not segment names)
  const globalParams = useGlobalSearchParams<{ groupId?: string }>();
  const activeGroupIdRef = useRef<string | null>(null);
  const isInGroupsSection = (segments as string[]).includes('(groups)');

  // Update ref when we have a direct groupId from the route
  useEffect(() => {
    if (globalParams.groupId) {
      activeGroupIdRef.current = globalParams.groupId;
    }
    // Clear when navigating away from groups entirely
    if (!isInGroupsSection) {
      activeGroupIdRef.current = null;
    }
  }, [globalParams.groupId, isInGroupsSection]);

  // Use direct groupId if available, otherwise fall back to ref (for sub-pages like retreat/[id])
  const activeGroupId = isInGroupsSection
    ? (globalParams.groupId || activeGroupIdRef.current)
    : null;

  const navItems: NavItem[] = [
    {
      key: 'events',
      label: t('navigation.events') || 'Events',
      icon: 'calendar-outline',
      activeIcon: 'calendar',
      route: '/(tabs)/(events)',
      segment: '(events)',
    },
    {
      key: 'home',
      label: t('navigation.retreats') || 'Retreats',
      icon: 'library-outline',
      activeIcon: 'library',
      route: '/(tabs)/(groups)',
      segment: '(groups)',
    },
    {
      key: 'search',
      label: t('navigation.search') || 'Search',
      icon: 'search-outline',
      activeIcon: 'search',
      route: '/(tabs)/search',
      segment: 'search',
    },
  ];

  // Use segments array to determine active state (more reliable than pathname for group routes)
  const isActive = useCallback(
    (item: NavItem): boolean => {
      return (segments as string[]).includes(item.segment);
    },
    [segments]
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

  const getSubscriptionLabel = (): string => {
    if (!isAuthenticated) return '';
    if (hasActiveSubscription) return t('profile.activeSubscription') || 'Active subscription';
    return t('profile.inactiveSubscription') || 'Inactive subscription';
  };

  // ── Data fetching ──────────────────────────────────────────────────

  useEffect(() => {
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
  }, [isAuthenticated, hasActiveSubscription]);

  // Close menu on click outside (web)
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      // Close if clicking outside the menu area
      const target = e.target as HTMLElement;
      if (!target.closest('[data-user-menu]')) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleGroupPress = useCallback((group: RetreatGroup) => {
    router.push(`/(tabs)/(groups)/${group.id}` as any);
  }, []);

  const handleSignOut = useCallback(async () => {
    setMenuOpen(false);
    clearTrack();
    await logout();
    router.replace('/(tabs)/(events)' as any);
  }, [logout, clearTrack]);

  // ── Render ──────────────────────────────────────────────────────────

  const isSettingsActive = pathname.includes('/settings');
  const isSubscriptionActive = pathname.includes('/subscription');
  const isMenuItemActive = isSettingsActive || isSubscriptionActive;

  return (
    <View style={styles.container}>
      {/* Logo and app name */}
      <View style={styles.logoSection}>
        <Pressable
          style={styles.logoRow}
          onPress={() => handleNavPress(isAuthenticated ? '/(tabs)/(groups)' : '/(tabs)/(events)')}
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
      </View>

      {/* Navigation items (Retreats + Events only) */}
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

      {/* Divider + Groups section — only for authenticated users with subscription */}
      {isAuthenticated && hasActiveSubscription && (
        <>
        <View style={styles.divider} />

        <View style={styles.groupsSection}>
          <Text style={styles.sectionHeader}>
            {(t('groups.yourGroups') || 'YOUR GROUPS').toUpperCase()}
          </Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.burgundy[500]} />
            </View>
          ) : (
            <ScrollView style={styles.groupsScrollView} showsVerticalScrollIndicator={false}>
              {groups.map((group) => {
              const isHoveredGroup = hoveredGroupItem === group.id;
              const isGroupActive = activeGroupId === group.id;

              const abbr = group.abbreviation
                || getTranslatedName(group, language as 'en' | 'pt')
                    .split(/\s+/)
                    .map(w => w[0])
                    .join('')
                    .substring(0, 3)
                    .toUpperCase();

              return (
                <Pressable
                  key={group.id}
                  style={[
                    styles.groupItem,
                    isGroupActive && styles.groupItemActive,
                    isHoveredGroup && !isGroupActive && styles.groupItemHover,
                  ]}
                  onPress={() => handleGroupPress(group)}
                  // @ts-ignore -- web-only mouse events
                  onMouseEnter={() => setHoveredGroupItem(group.id)}
                  // @ts-ignore
                  onMouseLeave={() => setHoveredGroupItem(null)}
                  accessibilityRole="button"
                  accessibilityLabel={getTranslatedName(group, language as 'en' | 'pt')}
                  accessibilityState={{ selected: isGroupActive }}
                >
                  <View style={[
                    styles.groupCircle,
                    isGroupActive && styles.groupCircleActive,
                  ]}>
                    <Text style={[
                      styles.groupCircleText,
                      isGroupActive && styles.groupCircleTextActive,
                    ]}>
                      {abbr}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.groupItemText,
                      isGroupActive && styles.groupItemTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {getTranslatedName(group, language as 'en' | 'pt')}
                  </Text>
                </Pressable>
              );
            })}
            </ScrollView>
          )}
        </View>
        </>
      )}

      {/* User footer with dropdown menu */}
      <View
        style={styles.userFooter}
        // @ts-ignore -- web data attribute
        dataSet={{ userMenu: true }}
        data-user-menu="true"
      >
        <View style={styles.footerDivider} />

        {/* Dropdown menu (opens upward) */}
        {menuOpen && (
          <View style={styles.dropdownMenu} data-user-menu="true">
            {/* Settings */}
            <Pressable
              style={[
                styles.menuItem,
                isSettingsActive && styles.menuItemActive,
                hoveredMenuItem === 'settings' && styles.menuItemHover,
              ]}
              onPress={() => {
                setMenuOpen(false);
                handleNavPress('/(tabs)/settings');
              }}
              // @ts-ignore
              onMouseEnter={() => setHoveredMenuItem('settings')}
              // @ts-ignore
              onMouseLeave={() => setHoveredMenuItem(null)}
              data-user-menu="true"
            >
              <Ionicons
                name={isSettingsActive ? 'settings' : 'settings-outline'}
                size={18}
                color={isSettingsActive ? colors.burgundy[500] : colors.gray[600]}
              />
              <Text style={[styles.menuItemText, isSettingsActive && styles.menuItemTextActive]}>
                {t('navigation.settings') || 'Settings'}
              </Text>
            </Pressable>

            {/* Subscription */}
            <Pressable
              style={[
                styles.menuItem,
                isSubscriptionActive && styles.menuItemActive,
                hoveredMenuItem === 'subscription' && styles.menuItemHover,
              ]}
              onPress={() => {
                setMenuOpen(false);
                handleNavPress('/(tabs)/subscription');
              }}
              // @ts-ignore
              onMouseEnter={() => setHoveredMenuItem('subscription')}
              // @ts-ignore
              onMouseLeave={() => setHoveredMenuItem(null)}
              data-user-menu="true"
            >
              <Ionicons
                name={isSubscriptionActive ? 'card' : 'card-outline'}
                size={18}
                color={isSubscriptionActive ? colors.burgundy[500] : colors.gray[600]}
              />
              <Text style={[styles.menuItemText, isSubscriptionActive && styles.menuItemTextActive]}>
                {t('navigation.subscription') || 'Subscription'}
              </Text>
            </Pressable>

            {/* Divider */}
            <View style={styles.menuDivider} />

            {/* Sign out */}
            <Pressable
              style={[
                styles.menuItem,
                hoveredMenuItem === 'signout' && styles.menuItemHover,
              ]}
              onPress={handleSignOut}
              // @ts-ignore
              onMouseEnter={() => setHoveredMenuItem('signout')}
              // @ts-ignore
              onMouseLeave={() => setHoveredMenuItem(null)}
              data-user-menu="true"
            >
              <Ionicons name="log-out-outline" size={18} color={colors.gray[600]} />
              <Text style={styles.menuItemText}>
                {t('common.logout') || 'Log out'}
              </Text>
            </Pressable>
          </View>
        )}

        {isAuthenticated && user ? (
          <Pressable
            style={[styles.userRow, menuOpen && styles.userRowActive]}
            onPress={() => setMenuOpen(!menuOpen)}
            accessibilityRole="button"
            accessibilityLabel={`${user.name}, ${getSubscriptionLabel()}`}
            data-user-menu="true"
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
            <Ionicons
              name={menuOpen ? 'chevron-down' : 'chevron-up'}
              size={14}
              color={colors.gray[400]}
              style={styles.userChevron}
            />
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.white,
  },

  /* Logo section — aligned with main panel header (paddingTop: 32) */
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 32,
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

  /* Groups section — flat list, same font size as nav */
  groupsSection: {
    paddingHorizontal: 8,
    marginTop: 16,
    flex: 1,
  },
  groupsScrollView: {
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
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    marginBottom: 2,
  },
  groupItemHover: {
    backgroundColor: colors.cream[50],
  },
  groupCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  groupCircleActive: {
    backgroundColor: colors.burgundy[500],
  },
  groupCircleText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray[600],
    letterSpacing: 0.3,
  },
  groupCircleTextActive: {
    color: colors.white,
  },
  groupItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray[600],
    flex: 1,
  },
  groupItemActive: {
    backgroundColor: colors.cream[100],
    borderLeftWidth: 3,
    borderLeftColor: colors.burgundy[500],
  },
  groupItemTextActive: {
    color: colors.burgundy[500],
    fontWeight: '600',
  },

  /* User footer */
  userFooter: {
    marginTop: 'auto',
    paddingHorizontal: 12,
    paddingBottom: 12,
    position: 'relative',
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
  userRowActive: {
    backgroundColor: colors.cream[50],
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
  userChevron: {
    marginLeft: 4,
  },
  signInText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.burgundy[500],
    marginLeft: 10,
  },

  /* Dropdown menu (opens upward from user footer) */
  dropdownMenu: {
    position: 'absolute',
    bottom: '100%',
    left: 8,
    right: 8,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 4,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
    zIndex: 100,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginHorizontal: 4,
    marginVertical: 1,
  },
  menuItemActive: {
    backgroundColor: colors.cream[100],
  },
  menuItemHover: {
    backgroundColor: colors.cream[50],
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray[700],
    marginLeft: 10,
  },
  menuItemTextActive: {
    color: colors.burgundy[500],
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginHorizontal: 14,
    marginVertical: 4,
  },
});
