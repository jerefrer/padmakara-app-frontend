import { useAuth } from '@/contexts/AuthContext';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import progressService from '@/services/progressService';
import { StorageSection } from '@/components/StorageSection';

import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

const colors = {
  cream: {
    100: '#fefefe',
  },
  burgundy: {
    50: '#f8f1f1',
    500: '#9b1b1b',
    600: '#7b1616',
  },
  saffron: {
    500: '#f59e0b',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#2c2c2c',
  },
};

interface UserStats {
  totalTracks: number;
  completedTracks: number;
  totalListeningTime: number;
  totalHighlights: number;
  totalBookmarks: number;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { language, contentLanguage, setLanguage, setContentLanguage, t } = useLanguage();
  const { user, isAuthenticated, updateUser, enableBiometric, disableBiometric, logout, forgetDevice } = useAuth();
  const { isDesktop } = useDesktopLayout();
  const { clearTrack } = useAudioPlayerContext();
  const [_stats, setStats] = useState<UserStats>({
    totalTracks: 0,
    completedTracks: 0,
    totalListeningTime: 0,
    totalHighlights: 0,
    totalBookmarks: 0,
  });
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [isClearing, setIsClearing] = useState(false);


  // Cross-platform alert system (only the UI implementation differs by platform)
  const showAlert = (title: string, message: string, buttons?: {text: string, onPress?: () => void, style?: string}[]) => {
    if (Platform.OS === 'web') {
      // Use browser confirm dialog for web (technical limitation - React Native Alert doesn't work on web)
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed && buttons) {
        const confirmButton = buttons.find(btn => btn.style === 'destructive' || btn.text !== 'Cancel');
        if (confirmButton?.onPress) {
          confirmButton.onPress();
        }
      }
    } else {
      // Use React Native Alert for mobile platforms (iOS/Android)
      Alert.alert(title, message, buttons);
    }
  };

  // Debug helper for click handling (all platforms)
  const debugClickHandler = (buttonName: string) => {
    console.log(`🔍 [${Platform.OS}] Button clicked: ${buttonName}`);
  };

  // Platform-specific error handling helper
  const getStorageErrorMessage = (error: any): string => {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';

    if (Platform.OS === 'web') {
      if (errorMessage.includes('localStorage') || errorMessage.includes('storage')) {
        return 'Storage access blocked. Please check browser settings and allow storage for this site.';
      }
      if (errorMessage.includes('quota') || errorMessage.includes('QuotaExceededError')) {
        return 'Browser storage is full. Please clear browser data or try in incognito mode.';
      }
      return 'Web storage error. Please try refreshing the page or using a different browser.';
    } else {
      if (errorMessage.includes('AsyncStorage')) {
        return 'Device storage error. Please restart the app and try again.';
      }
      return 'Storage operation failed. Please restart the app and try again.';
    }
  };

  useEffect(() => {
    console.log(`🚀 [${Platform.OS}] Settings screen mounted - all authentication features work identically across platforms`);
    if (isAuthenticated) {
      loadUserStats();
      checkBiometricSupport();
    }
  }, [isAuthenticated]);



  const loadUserStats = async () => {
    try {
      console.log(`📊 [${Platform.OS}] Loading user stats...`);
      const listeningStats = await progressService.getListeningStats();
      const allPDFProgress = await progressService.getAllPDFProgress();

      // Calculate highlights and bookmarks (simulated)
      const totalHighlights = allPDFProgress.reduce((sum, pdf) => sum + pdf.highlights.length, 0);
      const totalBookmarks = 15; // Simulated - would get from actual bookmarks

      setStats({
        totalTracks: listeningStats.totalTracks,
        completedTracks: listeningStats.completedTracks,
        totalListeningTime: listeningStats.totalListeningTime,
        totalHighlights,
        totalBookmarks,
      });

      console.log(`✅ [${Platform.OS}] User stats loaded successfully`);
    } catch (error) {
      console.error(`💥 [${Platform.OS}] Error loading user stats:`, error);

      // Set fallback stats if loading fails
      setStats({
        totalTracks: 0,
        completedTracks: 0,
        totalListeningTime: 0,
        totalHighlights: 0,
        totalBookmarks: 0,
      });
    }
  };

  const checkBiometricSupport = async () => {
    try {
      const isAvailable = await LocalAuthentication.hasHardwareAsync();
      setBiometricAvailable(isAvailable);

      if (isAvailable) {
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Fingerprint');
        } else {
          setBiometricType('Biometric');
        }
      }
    } catch (error) {
      console.error('Error checking biometric support:', error);
    }
  };

  const handleSignInPress = () => {
    router.push({ pathname: '/(auth)/magic-link', params: { returnTo: '/(tabs)/settings' } });
  };

  const toggleLanguage = async () => {
    const newLanguage = language === 'en' ? 'pt' : 'en';

    // Update local state and user preferences (if authenticated)
    if (isAuthenticated && user) {
      const updatedPreferences = {
        ...(user.preferences || {}),
        language: newLanguage,
      };
      await updateUser({ preferences: updatedPreferences });
    }
    await setLanguage(newLanguage);
  };

  const toggleContentLanguage = async () => {
    // Cycle through: en -> en-pt -> pt -> en
    let newContentLanguage: 'en' | 'en-pt' | 'pt';
    switch (contentLanguage) {
      case 'en':
        newContentLanguage = 'en-pt';
        break;
      case 'en-pt':
        newContentLanguage = 'pt';
        break;
      case 'pt':
        newContentLanguage = 'en';
        break;
      default:
        newContentLanguage = 'en';
    }

    if (isAuthenticated && user) {
      const updatedPreferences = {
        ...(user.preferences || {}),
        contentLanguage: newContentLanguage,
      };
      await updateUser({ preferences: updatedPreferences });
    }
    await setContentLanguage(newContentLanguage);
  };



  const toggleBiometric = async (enabled: boolean) => {
    if (enabled && biometricAvailable) {
      try {
        const result = await enableBiometric();
        if (result.success) {
          showAlert('Success', `${biometricType} has been enabled for app access.`);
        } else {
          showAlert('Error', result.error || 'Failed to enable biometric authentication');
        }
      } catch (error) {
        console.error('Biometric authentication error:', error);
        showAlert('Error', 'Failed to enable biometric authentication');
      }
    } else {
      try {
        const result = await disableBiometric();
        if (result.success) {
          showAlert('Success', 'Biometric authentication has been disabled.');
        } else {
          showAlert('Error', result.error || 'Failed to disable biometric authentication');
        }
      } catch (error) {
        console.error('Biometric disable error:', error);
        showAlert('Error', 'Failed to disable biometric authentication');
      }
    }
  };


  const _formatListeningTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Sign Out handler - works identically on all platforms (iOS, Android, Web)
  // Only clears local auth data, keeps device activated on backend for easy re-entry
  const handleSignOut = () => {
    if (isClearing) return; // Prevent multiple simultaneous operations

    showAlert(
      'Sign Out',
      'Sign out of your account? You can sign back in easily with the same email address.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              console.log(`🚪 [${Platform.OS}] Starting sign out operation...`);
              clearTrack();
              await logout(); // Same logout logic for all platforms
              console.log(`✅ [${Platform.OS}] Sign out completed successfully`);
              router.replace('/(tabs)/(events)');
            } catch (error) {
              console.error(`💥 [${Platform.OS}] Sign out error:`, error);
              const errorMessage = getStorageErrorMessage(error);
              showAlert(
                'Sign Out Error',
                `Failed to sign out: ${errorMessage}. You may need to restart the app.`
              );
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  // Forget Device handler - works identically on all platforms (iOS, Android, Web)
  // Fully deactivates device on backend, requires email activation to return
  const handleForgetDevice = () => {
    if (isClearing) return; // Prevent multiple simultaneous operations

    showAlert(
      'Forget This Device',
      'This will completely remove this device from your account. You\'ll need to activate via email again to access the app. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget Device',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              console.log(`🗑️ [${Platform.OS}] Starting forget device operation...`);
              clearTrack();
              await forgetDevice(); // Same forgetDevice logic for all platforms
              console.log(`✅ [${Platform.OS}] Device forgotten successfully`);
              router.replace('/(tabs)/(events)');
            } catch (error) {
              console.error(`💥 [${Platform.OS}] Forget device error:`, error);
              const errorMessage = getStorageErrorMessage(error);
              showAlert(
                'Device Removal Error',
                `Failed to remove device: ${errorMessage}. You may need to restart the app.`
              );
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          style={[
            styles.scrollView,
            isDesktop && styles.desktopScrollView,
          ]}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Desktop page title */}
          {isDesktop && (
            <Text style={styles.desktopPageTitle}>{t('navigation.settings') || 'Settings'}</Text>
          )}

          {/* Language Settings */}
          <Text style={[styles.sectionTitleOutside, isDesktop && styles.desktopSectionTitle]}>{t('profile.languageSettings') || 'Language Settings'}</Text>
          <View style={styles.section}>
            <Pressable
              style={({ pressed }) => [
                styles.settingItem,
                pressed && Platform.OS === 'web' && styles.webPressed
              ]}
              onPress={() => {
                debugClickHandler('Toggle Language');
                toggleLanguage();
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="language-outline" size={20} color={colors.burgundy[500]} />
                <Text style={styles.settingTitle}>{t('profile.language') || 'App Language'}</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>
                  {language === 'en' ? 'English' : 'Português'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.settingItem,
                pressed && Platform.OS === 'web' && styles.webPressed
              ]}
              onPress={() => {
                debugClickHandler('Toggle Content Language');
                toggleContentLanguage();
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="headset-outline" size={20} color={colors.burgundy[500]} />
                <Text style={styles.settingTitle}>{t('profile.contentLanguage') || 'Tracks Language'}</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>
                  {contentLanguage === 'en' ? (t('profile.englishOnly') || 'English Only') :
                   contentLanguage === 'en-pt' ? (t('profile.englishPortuguese') || 'English + Portuguese') :
                   (t('profile.portugueseOnly') || 'Portuguese Only')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
              </View>
            </Pressable>
          </View>

          {/* Sign In prompt for unauthenticated users */}
          {!isAuthenticated && (
            <>
              <Text style={styles.sectionTitleOutside}>{t('profile.account') || 'Account'}</Text>
              <View style={styles.section}>
                <View style={styles.signInPrompt}>
                  <Ionicons name="person-circle-outline" size={48} color={colors.gray[400]} />
                  <Text style={styles.signInPromptText}>
                    {t('groups.signInPrompt') || 'Retreat participants can sign in to access their recordings.'}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.signInButton,
                      pressed && styles.signInButtonPressed,
                    ]}
                    onPress={handleSignInPress}
                  >
                    <Text style={styles.signInButtonText}>
                      {t('groups.signIn') || 'Sign In'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {/* Storage Management - only for authenticated users */}
          {isAuthenticated && (
            <>
              <Text style={styles.sectionTitleOutside}>{t('profile.storage') || 'Storage'}</Text>
              <StorageSection />
            </>
          )}

          {/* Security Settings - only for authenticated users on native (biometric not available on web) */}
          {isAuthenticated && Platform.OS !== 'web' && (
            <>
              <Text style={styles.sectionTitleOutside}>{t('profile.security') || 'Security'}</Text>
              <View style={styles.section}>
                <View style={styles.settingItem}>
                  <View style={styles.settingLeft}>
                    <Ionicons
                      name={biometricType === 'Face ID' ? 'scan' : 'finger-print'}
                      size={20}
                      color={colors.burgundy[500]}
                    />
                    <View style={styles.textContainer}>
                      <Text style={styles.settingTitle}>
                        {biometricAvailable ? `${biometricType} Authentication` : t('profile.biometricAuth')}
                      </Text>
                      <Text style={styles.settingSubtitle}>
                        {biometricAvailable ? t('profile.secureAccess') : t('profile.notAvailable')}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={user?.preferences?.biometricEnabled || false}
                    onValueChange={toggleBiometric}
                    disabled={!biometricAvailable}
                    trackColor={{ false: colors.gray[300], true: colors.burgundy[500] }}
                  />
                </View>
              </View>
            </>
          )}

          {/* Account Status - only for authenticated users */}
          {isAuthenticated && user && (
            <>
              <Text style={styles.sectionTitleOutside}>
                {Platform.OS === 'web'
                  ? (t('subscription.status') || 'Subscription')
                  : (t('profile.accountStatus') || 'Account Status')}
              </Text>
              <View style={styles.section}>
                <View style={styles.settingItem}>
                  <View style={styles.settingLeft}>
                    <Ionicons
                      name={user.subscription?.status === 'active' ? 'checkmark-circle' : 'information-circle-outline'}
                      size={20}
                      color={user.subscription?.status === 'active' ? '#16a34a' : colors.gray[400]}
                    />
                    <View style={styles.textContainer}>
                      {Platform.OS === 'web' ? (
                        <>
                          <Text style={styles.settingTitle}>
                            {user.subscription?.status === 'active'
                              ? (t('subscription.active') || 'Active')
                              : user.subscription?.status === 'expired'
                              ? (t('subscription.expired') || 'Expired')
                              : (t('subscription.none') || 'No subscription')}
                          </Text>
                          {user.subscription?.status === 'active' && user.subscription.expiresAt && (
                            <Text style={styles.settingSubtitle}>
                              {t('subscription.expiresOn') || 'Expires'}: {new Date(user.subscription.expiresAt).toLocaleDateString()}
                            </Text>
                          )}
                          {user.subscription?.status !== 'active' && (
                            <Text style={styles.settingSubtitle}>
                              {t('subscription.subscribeCta') || 'Subscribe to access retreat recordings'}
                            </Text>
                          )}
                        </>
                      ) : (
                        <>
                          <Text style={styles.settingTitle}>
                            {user.subscription?.status === 'active'
                              ? (t('profile.accessGranted') || 'Signed in')
                              : (t('profile.limitedAccess') || 'Public content only')}
                          </Text>
                          <Text style={styles.settingSubtitle}>
                            {user.subscription?.status === 'active'
                              ? (t('profile.accessGrantedDescription') || 'You have access to retreat recordings')
                              : (t('profile.visitWebsite') || 'Visit app.padmakara.pt to manage your account')}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Account Management - only for authenticated users */}
          {isAuthenticated && (
            <>
              <Text style={styles.sectionTitleOutside}>{t('profile.account') || 'Account'}</Text>
              <View style={styles.section}>
                {/* User Profile Info */}
                <View style={styles.accountUserInfo}>
                  <Ionicons name="person-circle-outline" size={40} color={colors.burgundy[500]} />
                  <View style={styles.accountUserText}>
                    <Text style={styles.accountUserName}>{user?.name || 'User'}</Text>
                    <Text style={styles.accountUserEmail}>{user?.email || 'user@example.com'}</Text>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.settingItem,
                    isClearing && styles.disabledSetting,
                    pressed && Platform.OS === 'web' && styles.webPressed
                  ]}
                  onPress={() => {
                    debugClickHandler('Sign Out');
                    if (!isClearing) handleSignOut();
                  }}
                  disabled={isClearing}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons
                      name="log-out-outline"
                      size={20}
                      color={isClearing ? colors.gray[400] : colors.burgundy[500]}
                    />
                    <View style={styles.textContainer}>
                      <Text style={[
                        styles.settingTitle,
                        { color: isClearing ? colors.gray[400] : colors.burgundy[500] }
                      ]}>
                        {t('profile.signOut') || 'Sign Out'}
                      </Text>
                      <Text style={[styles.settingSubtitle, isClearing && styles.disabledText]}>
                        {t('profile.signOutDescription') || 'Sign out of your account (keeps device activated)'}
                      </Text>
                    </View>
                  </View>
                  {isClearing ? (
                    <Ionicons name="hourglass-outline" size={16} color={colors.gray[400]} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
                  )}
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.settingItem,
                    isClearing && styles.disabledSetting,
                    pressed && Platform.OS === 'web' && styles.webPressed
                  ]}
                  onPress={() => {
                    debugClickHandler('Forget This Device');
                    if (!isClearing) handleForgetDevice();
                  }}
                  disabled={isClearing}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={20}
                      color={isClearing ? colors.gray[400] : "#ef4444"}
                    />
                    <View style={styles.textContainer}>
                      <Text style={[
                        styles.settingTitle,
                        { color: isClearing ? colors.gray[400] : '#ef4444' }
                      ]}>
                        {t('profile.forgetDevice') || 'Forget This Device'}
                      </Text>
                      <Text style={[styles.settingSubtitle, isClearing && styles.disabledText]}>
                        {t('profile.forgetDeviceDescription') || 'Remove device completely (requires email activation)'}
                      </Text>
                    </View>
                  </View>
                  {isClearing ? (
                    <Ionicons name="hourglass-outline" size={16} color={colors.gray[400]} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
                  )}
                </Pressable>
              </View>
            </>
          )}

          {/* About Section */}
          <Text style={styles.sectionTitleOutside}>{t('profile.about') || 'About'}</Text>
          <View style={styles.section}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="information-circle-outline" size={20} color={colors.burgundy[500]} />
                <Text style={styles.settingTitle}>{t('profile.version') || 'Version'}</Text>
              </View>
              <Text style={styles.settingValue}>1.0.0 (Beta)</Text>
            </View>
          </View>
        </ScrollView>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  scrollView: {
    flex: 1,
  },
  desktopScrollView: {
    maxWidth: 720,
    width: '100%' as unknown as number,
    alignSelf: 'center' as const,
    paddingHorizontal: 40,
  },
  desktopPageTitle: {
    fontSize: 28,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[800],
    marginTop: 32,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  desktopSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[500],
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
  },
  accountUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  accountUserText: {
    marginLeft: 12,
    flex: 1,
  },
  accountUserName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[800],
  },
  accountUserEmail: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 2,
  },
  sectionTitleOutside: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[500],
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    marginTop: 32,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  section: {
    backgroundColor: 'transparent',
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'visible',
    marginHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.gray[800],
    marginLeft: 12,
  },
  settingSubtitle: {
    fontSize: 14,
    color: colors.gray[500],
    marginLeft: 12,
    marginTop: 2,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 14,
    color: colors.gray[600],
    marginRight: 8,
  },
  disabledSetting: {
    opacity: 0.6,
  },
  disabledText: {
    color: colors.gray[400],
  },
  webPressed: {
    backgroundColor: colors.gray[100],
    opacity: 0.8,
  },
  textContainer: {
    flex: 1,
    paddingRight: 16, // Prevents text from reaching chevron icon on all platforms
  },
  signInPrompt: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  signInPromptText: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
    lineHeight: 22,
  },
  signInButton: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 2,
  },
  signInButtonPressed: {
    backgroundColor: colors.burgundy[600],
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
  },
});
