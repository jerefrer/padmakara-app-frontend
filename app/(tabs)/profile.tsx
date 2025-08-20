import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet, Alert, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import progressService from '@/services/progressService';
import retreatService from '@/services/retreatService';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

const colors = {
  cream: {
    100: '#fcf8f3',
  },
  burgundy: {
    50: '#fef2f2',
    500: '#b91c1c',
    600: '#991b1b',
  },
  saffron: {
    500: '#f59e0b',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

interface UserStats {
  totalTracks: number;
  completedTracks: number;
  totalListeningTime: number;
  totalHighlights: number;
  totalBookmarks: number;
}

export default function ProfileScreen() {
  const { language, contentLanguage, setLanguage, setContentLanguage, t } = useLanguage();
  const { user, updateUser, enableBiometric, disableBiometric, logout } = useAuth();
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

  // Web-compatible alert system
  const showAlert = (title: string, message: string, buttons?: Array<{text: string, onPress?: () => void, style?: string}>) => {
    if (Platform.OS === 'web') {
      // Use browser confirm dialog for web
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed && buttons) {
        const confirmButton = buttons.find(btn => btn.style === 'destructive' || btn.text !== 'Cancel');
        if (confirmButton?.onPress) {
          confirmButton.onPress();
        }
      }
    } else {
      // Use React Native Alert for mobile
      Alert.alert(title, message, buttons);
    }
  };

  // Debug helper to test web click handling  
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
    console.log(`🚀 [${Platform.OS}] Profile screen mounted`);
    if (Platform.OS === 'web') {
      console.log('🌐 Web platform detected in profile screen');
      console.log('🌐 Window object available:', typeof window !== 'undefined');
      console.log('🌐 Alert function available:', typeof Alert !== 'undefined');
    }
    loadUserStats();
    checkBiometricSupport();
  }, []);

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

  const toggleLanguage = async () => {
    const newLanguage = language === 'en' ? 'pt' : 'en';
    if (user) {
      const updatedPreferences = {
        ...(user.preferences || {}),
        language: newLanguage,
      };
      await updateUser({ preferences: updatedPreferences });
    }
    await setLanguage(newLanguage);
  };

  const toggleContentLanguage = async () => {
    const newContentLanguage = contentLanguage === 'en' ? 'en-pt' : 'en';
    if (user) {
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

  const clearDownloads = () => {
    if (isClearing) return; // Prevent multiple simultaneous operations
    
    showAlert(
      'Clear Downloads',
      'This will remove all downloaded audio files. You can re-download them later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Downloads',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              console.log(`🧹 [${Platform.OS}] Starting clear downloads operation...`);
              const result = await retreatService.clearAllDownloads();
              
              if (result.success) {
                console.log(`✅ [${Platform.OS}] Downloads cleared: ${result.removedCount} files`);
                showAlert('Success', `Removed ${result.removedCount} downloaded files.`);
                // Reload stats to reflect changes
                await loadUserStats();
              } else {
                console.error(`❌ [${Platform.OS}] Clear downloads failed:`, result.error);
                showAlert('Error', result.error || 'Failed to clear downloads.');
              }
            } catch (error) {
              console.error(`💥 [${Platform.OS}] Clear downloads error:`, error);
              const errorMessage = getStorageErrorMessage(error);
              showAlert('Error', errorMessage);
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  const clearAllData = () => {
    if (isClearing) return; // Prevent multiple simultaneous operations
    
    showAlert(
      'Clear All Data',
      'This will remove all your progress, bookmarks, highlights, and cached retreat data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              console.log(`🧹 [${Platform.OS}] Starting clear all data operation...`);
              
              // Clear retreat cache and downloads
              await retreatService.clearAllCache();
              console.log(`✅ [${Platform.OS}] Retreat cache cleared`);
              
              // Clear progress data, bookmarks, and PDF highlights
              const progressResult = await progressService.clearAllData();
              console.log(`✅ [${Platform.OS}] Progress data cleared: ${progressResult.removedCount} items`);
              
              if (progressResult.success) {
                const totalCleared = progressResult.removedCount;
                showAlert(
                  'Success', 
                  `All local data has been cleared. Removed ${totalCleared} progress and bookmark items.`
                );
              } else {
                console.error(`❌ [${Platform.OS}] Progress clearing failed:`, progressResult.error);
                const errorMessage = getStorageErrorMessage(new Error(progressResult.error));
                showAlert(
                  'Partial Success', 
                  `Retreat cache cleared, but progress data clearing failed: ${errorMessage}`
                );
              }
              
              // Reload stats to reflect changes
              await loadUserStats();
              
            } catch (error) {
              console.error(`💥 [${Platform.OS}] Clear all data error:`, error);
              const errorMessage = getStorageErrorMessage(error);
              showAlert('Error', errorMessage);
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    if (isClearing) return; // Prevent multiple simultaneous operations
    
    showAlert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              console.log(`🚪 [${Platform.OS}] Starting logout operation...`);
              await logout();
              console.log(`✅ [${Platform.OS}] Logout completed successfully`);
              router.replace('/(auth)/magic-link');
            } catch (error) {
              console.error(`💥 [${Platform.OS}] Logout error:`, error);
              const errorMessage = getStorageErrorMessage(error);
              showAlert(
                'Logout Error', 
                `Failed to sign out completely: ${errorMessage}. You may need to restart the app.`
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
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.profileImage}
            contentFit="contain"
          />
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
        </View>


        {/* Language Settings */}
        <Text style={styles.sectionTitleOutside}>{t('profile.languageSettings') || 'Language Settings'}</Text>
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
              <Text style={styles.settingTitle}>{t('profile.contentLanguage') || 'Content Language'}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {contentLanguage === 'en' ? t('profile.englishOnly') || 'English Only' : t('profile.englishPortuguese') || 'English + Portuguese'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
            </View>
          </Pressable>
        </View>

        {/* Security Settings */}
        <Text style={styles.sectionTitleOutside}>{t('profile.security') || 'Security'}</Text>
        <View style={styles.section}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons 
                name={biometricType === 'Face ID' ? 'scan' : 'finger-print'} 
                size={20} 
                color={colors.burgundy[500]} 
              />
              <View>
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

        {/* Account Management */}
        <Text style={styles.sectionTitleOutside}>Account</Text>
        <View style={styles.section}>
          <Pressable 
            style={({ pressed }) => [
              styles.settingItem, 
              isClearing && styles.disabledSetting,
              pressed && Platform.OS === 'web' && styles.webPressed
            ]} 
            onPress={() => {
              debugClickHandler('Clear Downloads');
              if (!isClearing) clearDownloads();
            }}
            disabled={isClearing}
          >
            <View style={styles.settingLeft}>
              <Ionicons 
                name="cloud-download-outline" 
                size={20} 
                color={isClearing ? colors.gray[400] : colors.saffron[500]} 
              />
              <View>
                <Text style={[styles.settingTitle, isClearing && styles.disabledText]}>
                  Clear Downloads
                </Text>
                <Text style={[styles.settingSubtitle, isClearing && styles.disabledText]}>
                  Remove all downloaded audio files
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
              debugClickHandler('Clear All Data');
              if (!isClearing) clearAllData();
            }}
            disabled={isClearing}
          >
            <View style={styles.settingLeft}>
              <Ionicons 
                name="trash-outline" 
                size={20} 
                color={isClearing ? colors.gray[400] : "#ef4444"} 
              />
              <View>
                <Text style={[
                  styles.settingTitle, 
                  { color: isClearing ? colors.gray[400] : '#ef4444' }
                ]}>
                  Clear All Data
                </Text>
                <Text style={[styles.settingSubtitle, isClearing && styles.disabledText]}>
                  Remove all progress and downloaded content
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
              debugClickHandler('Sign Out');
              if (!isClearing) handleLogout();
            }}
            disabled={isClearing}
          >
            <View style={styles.settingLeft}>
              <Ionicons 
                name="log-out-outline" 
                size={20} 
                color={isClearing ? colors.gray[400] : "#ef4444"} 
              />
              <View>
                <Text style={[
                  styles.settingTitle, 
                  { color: isClearing ? colors.gray[400] : '#ef4444' }
                ]}>
                  Sign Out
                </Text>
                <Text style={[styles.settingSubtitle, isClearing && styles.disabledText]}>
                  Sign out of your account
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

        {/* About Section */}
        <Text style={styles.sectionTitleOutside}>About</Text>
        <View style={styles.section}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="information-circle-outline" size={20} color={colors.burgundy[500]} />
              <Text style={styles.settingTitle}>Version</Text>
            </View>
            <Text style={styles.settingValue}>1.0.0 (Beta)</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  profileHeader: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  profileImage: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.burgundy[500],
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: colors.gray[600],
    marginBottom: 12,
  },
  sectionTitleOutside: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginTop: 32,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  section: {
    backgroundColor: 'white',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
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
});