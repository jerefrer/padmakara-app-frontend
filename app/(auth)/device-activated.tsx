import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';

const colors = {
  cream: {
    50: '#fefdfb',
    100: '#fcf8f3',
    200: '#f7f0e4',
  },
  burgundy: {
    500: '#b91c1c',
    600: '#991b1b',
  },
  saffron: {
    500: '#f59e0b',
    600: '#d97706',
  },
  gray: {
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
  green: {
    500: '#10b981',
    600: '#059669',
  },
};

export default function DeviceActivatedScreen() {
  const { user_name, device_name } = useLocalSearchParams<{ 
    user_name?: string; 
    device_name?: string;
  }>();
  
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [settingUpBiometric, setSettingUpBiometric] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.5)).current;
  const celebrationScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkBiometricAvailability();
    
    // Entrance animations
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(successScale, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(celebrationScale, {
        toValue: 1,
        tension: 150,
        friction: 8,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      if (hasHardware && isEnrolled) {
        setBiometricAvailable(true);
        
        // Determine biometric type for display
        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Touch ID');
        } else {
          setBiometricType('Biometric');
        }
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    }
  };

  const handleSetupBiometric = async () => {
    setSettingUpBiometric(true);
    
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${biometricType} for Padmakara`,
        subPromptMessage: 'This will make signing in faster and more secure',
        cancelLabel: 'Not now',
      });

      if (result.success) {
        // Store biometric preference
        Alert.alert(
          `${biometricType} Enabled!`,
          'You can now use biometric authentication to sign in quickly and securely.',
          [
            { 
              text: 'Continue to App', 
              onPress: () => router.replace('/(tabs)') 
            }
          ]
        );
      } else {
        // User cancelled or failed - still continue to app
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Biometric setup error:', error);
      Alert.alert(
        'Setup Failed',
        'Unable to set up biometric authentication. You can enable it later in settings.',
        [
          { 
            text: 'Continue', 
            onPress: () => router.replace('/(tabs)') 
          }
        ]
      );
    } finally {
      setSettingUpBiometric(false);
    }
  };

  const handleSkipBiometric = () => {
    router.replace('/(tabs)');
  };

  const getBiometricIcon = () => {
    if (biometricType === 'Face ID') return 'scan';
    if (biometricType === 'Touch ID') return 'finger-print';
    return 'shield-checkmark';
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.cream[50], colors.cream[100]]}
        style={styles.background}
      >
        <Animated.View 
          style={[
            styles.content,
            { opacity: fadeAnim }
          ]}
        >
          {/* Success Icon with Celebration */}
          <Animated.View 
            style={[
              styles.successContainer,
              { transform: [{ scale: successScale }] }
            ]}
          >
            <View style={styles.successIconBackground}>
              <Ionicons 
                name="checkmark-circle" 
                size={64} 
                color={colors.green[500]} 
              />
            </View>
            
            {/* Celebration sparkles */}
            <Animated.View 
              style={[
                styles.celebrationContainer,
                { transform: [{ scale: celebrationScale }] }
              ]}
            >
              <View style={[styles.sparkle, styles.sparkle1]}>
                <Text style={styles.sparkleText}>✨</Text>
              </View>
              <View style={[styles.sparkle, styles.sparkle2]}>
                <Text style={styles.sparkleText}>🎉</Text>
              </View>
              <View style={[styles.sparkle, styles.sparkle3]}>
                <Text style={styles.sparkleText}>✨</Text>
              </View>
            </Animated.View>
          </Animated.View>

          {/* Welcome Message */}
          <View style={styles.welcomeContainer}>
            <Text style={styles.title}>Welcome!</Text>
            <Text style={styles.subtitle}>
              {user_name ? `Welcome ${user_name}! ` : ''}Your device has been successfully activated and you now have access to your retreat recordings.
            </Text>
          </View>

          {/* Device Info */}
          <View style={styles.deviceCard}>
            <Ionicons 
              name="phone-portrait" 
              size={20} 
              color={colors.burgundy[500]} 
            />
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceLabel}>Activated Device</Text>
              <Text style={styles.deviceName}>
                {device_name || 'This Device'}
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Active</Text>
            </View>
          </View>

          {/* Biometric Setup Section */}
          {biometricAvailable && (
            <View style={styles.biometricSection}>
              <View style={styles.biometricHeader}>
                <Ionicons 
                  name={getBiometricIcon()} 
                  size={24} 
                  color={colors.saffron[500]} 
                />
                <Text style={styles.biometricTitle}>
                  Secure Your Access
                </Text>
              </View>
              
              <Text style={styles.biometricDescription}>
                Enable {biometricType} for quick and secure access to your retreat content. 
                This makes signing in effortless while keeping your spiritual practice private.
              </Text>

              <View style={styles.biometricBenefits}>
                <View style={styles.benefit}>
                  <Ionicons name="flash" size={16} color={colors.green[500]} />
                  <Text style={styles.benefitText}>Instant access</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.green[500]} />
                  <Text style={styles.benefitText}>Enhanced security</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="heart" size={16} color={colors.green[500]} />
                  <Text style={styles.benefitText}>Peace of mind</Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            {biometricAvailable ? (
              <>
                {/* Enable Biometric Button */}
                <TouchableOpacity
                  style={[styles.primaryButton, settingUpBiometric && styles.buttonDisabled]}
                  onPress={handleSetupBiometric}
                  disabled={settingUpBiometric}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[colors.saffron[500], colors.saffron[600]]}
                    style={styles.buttonGradient}
                  >
                    {settingUpBiometric ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <Ionicons 
                          name={getBiometricIcon()} 
                          size={20} 
                          color="white" 
                        />
                        <Text style={styles.primaryButtonText}>
                          Enable {biometricType}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Skip Button */}
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={handleSkipBiometric}
                  disabled={settingUpBiometric}
                >
                  <Text style={styles.skipButtonText}>Skip for now</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Continue Button (no biometric available) */
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.replace('/(tabs)')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.burgundy[500], colors.burgundy[600]]}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.primaryButtonText}>
                    Continue to App
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {/* Dharma Quote */}
          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText}>
              "Like a lamp dispelling darkness, may these teachings illuminate your path."
            </Text>
            <Text style={styles.quoteAuthor}>— Buddhist Blessing</Text>
          </View>
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successContainer: {
    position: 'relative',
    marginBottom: 40,
  },
  successIconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.green[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 4,
    borderColor: colors.cream[200],
  },
  celebrationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sparkle: {
    position: 'absolute',
  },
  sparkle1: {
    top: -10,
    right: 10,
  },
  sparkle2: {
    bottom: -5,
    left: -5,
  },
  sparkle3: {
    top: 20,
    left: -15,
  },
  sparkleText: {
    fontSize: 20,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.burgundy[500],
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Georgia',
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 32,
    alignSelf: 'stretch',
    shadowColor: colors.gray[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  deviceLabel: {
    fontSize: 12,
    color: colors.gray[500],
    fontWeight: '500',
  },
  deviceName: {
    fontSize: 16,
    color: colors.gray[700],
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: colors.green[500],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  biometricSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    alignSelf: 'stretch',
    shadowColor: colors.saffron[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: colors.saffron[500],
  },
  biometricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  biometricTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray[700],
    marginLeft: 8,
  },
  biometricDescription: {
    fontSize: 15,
    color: colors.gray[600],
    lineHeight: 22,
    marginBottom: 16,
  },
  biometricBenefits: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  benefit: {
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 12,
    color: colors.gray[600],
    marginTop: 4,
    fontWeight: '500',
  },
  actionContainer: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  primaryButton: {
    borderRadius: 50,
    marginBottom: 16,
    shadowColor: colors.saffron[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 50,
    minHeight: 56,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipButtonText: {
    color: colors.gray[500],
    fontSize: 16,
    fontWeight: '600',
  },
  quoteContainer: {
    backgroundColor: colors.cream[200],
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignSelf: 'stretch',
  },
  quoteText: {
    fontSize: 14,
    color: colors.gray[600],
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  quoteAuthor: {
    fontSize: 12,
    color: colors.gray[500],
    textAlign: 'center',
    fontWeight: '500',
  },
});