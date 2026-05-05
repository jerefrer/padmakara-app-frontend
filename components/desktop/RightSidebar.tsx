import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { colors } from '@/constants/colors';

export type RightSidebarVariant = 'wide' | 'narrow';

interface RightSidebarProps {
  /** 'wide' is the default brand panel (logo + Padmakara title + name).
   *  'narrow' collapses to a 64px rail used on the event detail screen
   *  where horizontal space is at a premium. */
  variant?: RightSidebarVariant;
}

export function RightSidebar({ variant = 'wide' }: RightSidebarProps) {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const { clearTrack } = useAudioPlayerContext();
  const { t } = useLanguage();

  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);

  const isSettingsActive = pathname.includes('/settings');
  const isNarrow = variant === 'narrow';

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-right-menu]')) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const getUserInitials = (): string => {
    if (!user?.name) return '?';
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const handleSignOut = useCallback(async () => {
    setMenuOpen(false);
    clearTrack();
    await logout();
    router.replace('/(tabs)/(groups)' as any);
  }, [logout, clearTrack]);

  return (
    <View style={styles.container}>
      {/* Branding — wide shows logo + title; narrow shows just a small logo. */}
      <View style={[styles.brandingSection, isNarrow && styles.brandingSectionNarrow]}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={isNarrow ? styles.logoNarrow : styles.logo}
          resizeMode="contain"
        />
        {!isNarrow && (
          <>
            <Text style={styles.title}>Padmakara</Text>
            <Text style={styles.subtitle}>Ramo Lusófono</Text>
          </>
        )}
      </View>

      {/* Account section at bottom */}
      <View
        style={[styles.accountSection, isNarrow && styles.accountSectionNarrow]}
        // @ts-ignore
        dataSet={{ rightMenu: true }}
        data-right-menu="true"
      >
        {/* Dropdown menu (opens upward). In narrow mode it's anchored to
            the right edge but expands leftward so the menu items aren't
            clipped by the 64px rail. */}
        {menuOpen && (
          <View
            style={[styles.dropdownMenu, isNarrow && styles.dropdownMenuNarrow]}
            data-right-menu="true"
          >
            <Pressable
              style={[
                styles.menuItem,
                isSettingsActive && styles.menuItemActive,
                hoveredMenuItem === 'settings' && styles.menuItemHover,
              ]}
              onPress={() => {
                setMenuOpen(false);
                router.push('/(tabs)/settings' as any);
              }}
              // @ts-ignore
              onMouseEnter={() => setHoveredMenuItem('settings')}
              // @ts-ignore
              onMouseLeave={() => setHoveredMenuItem(null)}
              data-right-menu="true"
            >
              <Ionicons name="settings-outline" size={16} color={colors.gray[700]} />
              <Text style={styles.menuItemText}>
                {t('navigation.settings') || 'Settings'}
              </Text>
            </Pressable>

            <View style={styles.menuDivider} />

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
              data-right-menu="true"
            >
              <Ionicons name="log-out-outline" size={16} color={colors.gray[700]} />
              <Text style={styles.menuItemText}>
                {t('common.logout') || 'Log out'}
              </Text>
            </Pressable>
          </View>
        )}

        {isAuthenticated && user ? (
          <Pressable
            style={[styles.userRow, isNarrow && styles.userRowNarrow]}
            onPress={() => setMenuOpen(!menuOpen)}
            accessibilityRole="button"
            accessibilityLabel={user.name || 'Account'}
            data-right-menu="true"
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getUserInitials()}</Text>
            </View>
            {!isNarrow && (
              <Text style={styles.userName} numberOfLines={1}>
                {user.dharma_name || user.name}
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={[styles.loginRow, isNarrow && styles.loginRowNarrow]}
            onPress={() => router.push('/(auth)/magic-link' as any)}
            accessibilityRole="link"
            accessibilityLabel="Login"
          >
            <Ionicons name="person-outline" size={isNarrow ? 18 : 16} color={colors.white} />
            {!isNarrow && (
              <Text style={styles.loginText}>{t('common.login') || 'Login'}</Text>
            )}
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
    backgroundColor: colors.burgundy[500],
    justifyContent: 'space-between',
  },

  /* Branding */
  brandingSection: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  brandingSectionNarrow: {
    paddingHorizontal: 12,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
    tintColor: 'rgba(255,255,255,0.85)',
  },
  logoNarrow: {
    width: 36,
    height: 36,
    tintColor: 'rgba(255,255,255,0.85)',
  },
  title: {
    fontSize: 22,
    fontFamily: 'EBGaramond_400Regular',
    color: colors.white,
    letterSpacing: 4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 4,
    textAlign: 'center',
  },

  /* Account */
  accountSection: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    position: 'relative',
  },
  accountSectionNarrow: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  userRowNarrow: {
    flexDirection: 'column',
    padding: 6,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  userName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.white,
    marginLeft: 10,
    flex: 1,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  loginRowNarrow: {
    padding: 6,
  },
  loginText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.burgundy[50],
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
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  // Narrow rail can't fit a 200px menu, so anchor to the right edge of
  // the rail and let the menu extend leftward into the main content.
  dropdownMenuNarrow: {
    left: undefined as any,
    right: 8,
    width: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginHorizontal: 4,
    marginVertical: 1,
  },
  menuItemActive: {
    backgroundColor: colors.gray[100],
  },
  menuItemHover: {
    backgroundColor: colors.gray[100],
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray[700],
    marginLeft: 8,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginHorizontal: 12,
    marginVertical: 4,
  },
});
