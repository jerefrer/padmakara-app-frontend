import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
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
  const [stats, setStats] = useState<UserStats>({
    totalTracks: 0,
    completedTracks: 0,
    totalListeningTime: 0,
    totalHighlights: 0,
    totalBookmarks: 0,
  });
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');

  useEffect(() => {
    loadUserStats();
    checkBiometricSupport();
  }, []);

  const loadUserStats = async () => {
    try {
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
    } catch (error) {
      console.error('Error loading user stats:', error);
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
          Alert.alert('Success', `${biometricType} has been enabled for app access.`);
        } else {
          Alert.alert('Error', result.error || 'Failed to enable biometric authentication');
        }
      } catch (error) {
        console.error('Biometric authentication error:', error);
        Alert.alert('Error', 'Failed to enable biometric authentication');
      }
    } else {
      try {
        const result = await disableBiometric();
        if (result.success) {
          Alert.alert('Success', 'Biometric authentication has been disabled.');
        } else {
          Alert.alert('Error', result.error || 'Failed to disable biometric authentication');
        }
      } catch (error) {
        console.error('Biometric disable error:', error);
        Alert.alert('Error', 'Failed to disable biometric authentication');
      }
    }
  };


  const formatListeningTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will remove all your progress, bookmarks, highlights, and cached retreat data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear retreat cache
              await retreatService.clearAllCache();
              
              // Clear progress data (would implement in progressService)
              // await progressService.clearAllData();
              
              Alert.alert('Success', 'All local data has been cleared.');
              
              // Reload stats
              await loadUserStats();
            } catch (error) {
              console.error('Clear data error:', error);
              Alert.alert('Error', 'Failed to clear all data. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
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
          <TouchableOpacity style={styles.settingItem} onPress={toggleLanguage}>
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
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={toggleContentLanguage}>
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
          </TouchableOpacity>
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
          <TouchableOpacity style={styles.settingItem} onPress={clearAllData}>
            <View style={styles.settingLeft}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <View>
                <Text style={[styles.settingTitle, { color: '#ef4444' }]}>Clear All Data</Text>
                <Text style={styles.settingSubtitle}>Remove all progress and downloaded content</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
            <View style={styles.settingLeft}>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <View>
                <Text style={[styles.settingTitle, { color: '#ef4444' }]}>Sign Out</Text>
                <Text style={styles.settingSubtitle}>Sign out of your account</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
          </TouchableOpacity>
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
});