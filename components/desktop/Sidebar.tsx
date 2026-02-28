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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors } from '@/constants/colors';
import { getTranslatedName } from '@/utils/i18n';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import retreatService from '@/services/retreatService';
import { RetreatGroup } from '@/types';

/** Split a group name like "Preliminary Practices - Level 3 - Mandala"
 *  into { main: "Preliminary Practices", sub: "Level 3 · Mandala" } */
function splitGroupName(name: string): { main: string; sub?: string } {
  const parts = name.split(/\s*-\s*/);
  if (parts.length <= 1) return { main: name };
  return {
    main: parts[0],
    sub: parts.slice(1).join(' · '),
  };
}

interface NavItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  renderIcon?: (active: boolean, color: string) => React.ReactNode;
  route: string;
  segment: string;
}

interface TeacherCount {
  name: string;
  abbreviation: string;
  photoUrl?: string | null;
  eventCount: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const segments = useSegments();
  const { user, isAuthenticated, hasActiveSubscription, logout } = useAuth();
  const { clearTrack } = useAudioPlayerContext();
  const { t, language } = useLanguage();

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredGroupItem, setHoveredGroupItem] = useState<string | null>(null);
  const [hoveredTeacherItem, setHoveredTeacherItem] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);

  // Data states
  const [groups, setGroups] = useState<RetreatGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [teacherCounts, setTeacherCounts] = useState<TeacherCount[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);

  // Track active group from URL
  const globalParams = useGlobalSearchParams<{ groupId?: string; teacher?: string }>();
  const activeGroupIdRef = useRef<string | null>(null);
  const isInGroupsSection = (segments as string[]).includes('(groups)');
  const isInEventsSection = (segments as string[]).includes('(events)');

  useEffect(() => {
    if (globalParams.groupId) {
      activeGroupIdRef.current = globalParams.groupId;
    }
    if (!isInGroupsSection) {
      activeGroupIdRef.current = null;
    }
  }, [globalParams.groupId, isInGroupsSection]);

  const activeGroupId = isInGroupsSection
    ? (globalParams.groupId || activeGroupIdRef.current)
    : null;

  const activeTeacher = isInEventsSection ? (globalParams.teacher || null) : null;

  const navItems: NavItem[] = [
    {
      key: 'events',
      label: t('navigation.events') || 'Events',
      icon: 'people-outline',
      activeIcon: 'people',
      renderIcon: (active, color) => <MaterialCommunityIcons name={active ? 'account-group' : 'account-group-outline'} size={22} color={color} />,
      route: '/(tabs)/(events)',
      segment: '(events)',
    },
    {
      key: 'home',
      label: t('navigation.retreats') || 'Retreats',
      icon: 'body-outline',
      activeIcon: 'body',
      renderIcon: (active, color) => <MaterialCommunityIcons name="meditation" size={22} color={color} />,
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

  // Fetch groups for authenticated users
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

  // Fetch public events for teacher counts
  useEffect(() => {
    let cancelled = false;
    setTeachersLoading(true);

    retreatService.getPublicEvents().then((response) => {
      if (cancelled) return;
      if (response.success && response.data) {
        // Count number of events per teacher (not tracks)
        const countMap = new Map<string, { name: string; abbreviation: string; photoUrl?: string | null; eventCount: number }>();

        for (const event of response.data) {
          if (event.teachers) {
            for (const teacher of event.teachers) {
              const key = teacher.abbreviation || teacher.name;
              const existing = countMap.get(key);
              if (existing) {
                existing.eventCount++;
              } else {
                countMap.set(key, {
                  name: teacher.name,
                  abbreviation: teacher.abbreviation,
                  photoUrl: teacher.photoUrl,
                  eventCount: 1,
                });
              }
            }
          }
        }

        const sorted = Array.from(countMap.values())
          .filter(t => t.eventCount > 0)
          .sort((a, b) => b.eventCount - a.eventCount);

        setTeacherCounts(sorted);
      }
      setTeachersLoading(false);
    }).catch(() => {
      if (!cancelled) setTeachersLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  // Close menu on click outside (web)
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
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

  const showGroups = isInGroupsSection && isAuthenticated && hasActiveSubscription;
  const showTeachers = isInEventsSection && teacherCounts.length > 0;

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

      {/* Navigation items with nested sub-items */}
      <ScrollView style={styles.navScrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.navSection}>
          {navItems.map((item, index) => {
            const active = isActive(item);
            const isHoveredNav = hoveredItem === item.key;

            return (
              <View key={item.key}>
                {/* Nav item */}
                <Pressable
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
                  {item.renderIcon
                    ? item.renderIcon(active, active ? colors.burgundy[500] : colors.gray[500])
                    : <Ionicons
                        name={active ? item.activeIcon : item.icon}
                        size={20}
                        color={active ? colors.burgundy[500] : colors.gray[500]}
                      />
                  }
                  <Text
                    style={[
                      styles.navLabel,
                      active && styles.navLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>

                {/* Teachers nested under Events */}
                {item.key === 'events' && showTeachers && (
                  <View style={styles.teachersContainer}>
                    {teachersLoading ? (
                      <View style={styles.subLoadingContainer}>
                        <ActivityIndicator size="small" color={colors.burgundy[500]} />
                      </View>
                    ) : (
                      teacherCounts.map((teacher) => {
                        const isHovered = hoveredTeacherItem === teacher.abbreviation;
                        const isTeacherActive = activeTeacher === teacher.abbreviation;
                        return (
                          <Pressable
                            key={teacher.abbreviation}
                            style={[
                              styles.teacherItem,
                              isTeacherActive && styles.teacherItemActive,
                              isHovered && !isTeacherActive && styles.teacherItemHover,
                            ]}
                            onPress={() => router.push(`/(tabs)/(events)?teacher=${encodeURIComponent(teacher.abbreviation)}` as any)}
                            // @ts-ignore
                            onMouseEnter={() => setHoveredTeacherItem(teacher.abbreviation)}
                            // @ts-ignore
                            onMouseLeave={() => setHoveredTeacherItem(null)}
                          >
                            <Text style={[styles.teacherName, isTeacherActive && styles.teacherNameActive]} numberOfLines={1}>
                              {teacher.name}
                            </Text>
                            <Text style={[styles.teacherCount, isTeacherActive && styles.teacherCountActive]}>
                              {teacher.eventCount}
                            </Text>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                )}

                {/* Groups nested under Retreats */}
                {item.key === 'home' && showGroups && (
                  <View style={styles.subItemsContainer}>
                    {loading ? (
                      <View style={styles.subLoadingContainer}>
                        <ActivityIndicator size="small" color={colors.burgundy[500]} />
                      </View>
                    ) : (
                      groups.map((group) => {
                        const isHoveredGroup = hoveredGroupItem === group.id;
                        const isGroupActive = activeGroupId === group.id;

                        const abbr = group.abbreviation
                          || getTranslatedName(group, language as 'en' | 'pt')
                              .split(/\s+/)
                              .map(w => w[0])
                              .join('')
                              .substring(0, 3)
                              .toUpperCase();

                        const { main, sub } = splitGroupName(
                          getTranslatedName(group, language as 'en' | 'pt')
                        );

                        return (
                          <Pressable
                            key={group.id}
                            style={[
                              styles.groupItem,
                              isGroupActive && styles.groupItemActive,
                              isHoveredGroup && !isGroupActive && styles.groupItemHover,
                            ]}
                            onPress={() => handleGroupPress(group)}
                            // @ts-ignore
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
                            <View style={styles.groupTextContainer}>
                              <Text
                                style={[
                                  styles.groupItemText,
                                  isGroupActive && styles.groupItemTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                {main}
                              </Text>
                              {sub && (
                                <Text
                                  style={[
                                    styles.groupItemSub,
                                    isGroupActive && styles.groupItemSubActive,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {sub}
                                </Text>
                              )}
                            </View>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

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

  /* Logo section */
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 23,
    paddingRight: 16,
    paddingTop: 42,
    paddingBottom: 36,
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
    fontSize: 20,
    fontWeight: '400',
    fontFamily: 'EBGaramond_400Regular',
    color: colors.gray[600],
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  /* Navigation */
  navScrollView: {
    flex: 1,
  },
  navSection: {
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 0,
    marginTop: 8,
  },
  navItemActive: {
    backgroundColor: 'transparent',
  },
  navItemHover: {
    backgroundColor: '#f8f7f7',
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

  /* Sub-items container (groups under Retreats) */
  subItemsContainer: {
    paddingLeft: 0,
    paddingTop: 4,
    paddingBottom: 8,
  },
  subLoadingContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },

  /* Teachers container (no header) */
  teachersContainer: {
    paddingLeft: 0,
    paddingTop: 4,
    paddingBottom: 8,
  },

  /* Group sub-items */
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingLeft: 14,
    paddingRight: 16,
    borderRadius: 0,
    marginBottom: 1,
  },
  groupItemHover: {
    backgroundColor: '#f8f7f7',
  },
  groupCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupCircleActive: {
    backgroundColor: colors.burgundy[500],
  },
  groupCircleText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.gray[600],
    letterSpacing: 0.3,
  },
  groupCircleTextActive: {
    color: colors.white,
  },
  groupTextContainer: {
    flex: 1,
  },
  groupItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray[600],
  },
  groupItemSub: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.gray[400],
    marginTop: 1,
  },
  groupItemSubActive: {
    color: colors.burgundy[500],
    opacity: 0.7,
  },
  groupItemActive: {
    backgroundColor: 'transparent',
  },
  groupItemTextActive: {
    color: colors.burgundy[500],
    fontWeight: '600',
  },

  /* Teacher sub-items */
  teacherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 16,
    marginBottom: 0,
  },
  teacherItemHover: {
    backgroundColor: '#f8f7f7',
  },
  teacherItemActive: {
    backgroundColor: 'transparent',
  },
  teacherName: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.gray[500],
    flex: 1,
  },
  teacherNameActive: {
    color: colors.burgundy[500],
    fontWeight: '600',
  },
  teacherCount: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray[400],
    marginLeft: 6,
  },
  teacherCountActive: {
    color: colors.burgundy[500],
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
    backgroundColor: '#f8f7f7',
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

  /* Dropdown menu */
  dropdownMenu: {
    position: 'absolute',
    bottom: '100%',
    left: 8,
    right: 8,
    backgroundColor: colors.white,
    borderRadius: 8,
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
    backgroundColor: 'transparent',
  },
  menuItemHover: {
    backgroundColor: '#f8f7f7',
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
