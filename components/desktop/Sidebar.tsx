import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors } from '@/constants/colors';

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
  const { user, isAuthenticated, hasActiveSubscription } = useAuth();
  const { t } = useLanguage();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

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

  const getSubscriptionLabel = (): string => {
    if (!isAuthenticated) return '';
    if (hasActiveSubscription) return t('profile.activeSubscription') || 'Active';
    return t('profile.inactiveSubscription') || 'Inactive';
  };

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
          const hovered = hoveredItem === item.key;

          return (
            <Pressable
              key={item.key}
              style={[
                styles.navItem,
                active && styles.navItemActive,
                hovered && !active && styles.navItemHover,
              ]}
              onPress={() => handleNavPress(item.route)}
              // @ts-ignore — web-only mouse events
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

      {/* Content section: groups placeholder */}
      <View style={styles.contentSection}>
        <Text style={styles.sectionHeader}>
          {t('sidebar.yourGroups') || 'YOUR GROUPS'}
        </Text>
        <Text style={styles.placeholderText}>
          {t('common.loading') || 'Loading...'}
        </Text>
      </View>

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
    paddingHorizontal: 16,
    marginTop: 24,
    flex: 1,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray[500],
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 13,
    color: colors.gray[400],
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
});
