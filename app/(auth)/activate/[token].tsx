import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import magicLinkService from '@/services/magicLinkService';
import { useAuth } from '@/contexts/AuthContext';

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
  red: {
    500: '#ef4444',
    600: '#dc2626',
  },
};

type ActivationState = 'loading' | 'success' | 'error' | 'already_activated';

export default function ActivateDeviceScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { activateDeviceWithToken } = useAuth();
  
  const [activationState, setActivationState] = useState<ActivationState>('loading');
  const [message, setMessage] = useState('Activating your device...');
  const [userName, setUserName] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Spinning animation for loading
    const spinAnimation = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    if (activationState === 'loading') {
      spinAnimation.start();
    } else {
      spinAnimation.stop();
    }

    return () => spinAnimation.stop();
  }, [activationState]);

  useEffect(() => {
    if (token) {
      handleActivation();
    } else {
      setActivationState('error');
      setMessage('Invalid activation link - no token provided');
    }
  }, [token]);

  const handleActivation = async () => {
    if (!token) return;

    try {
      console.log('🔗 Activating device with token from deep link');
      setActivationState('loading');
      setMessage('Activating your device...');

      const result = await activateDeviceWithToken(token);

      if (result.success) {
        setActivationState('success');
        setUserName(result.user?.name || 'User');
        setDeviceName(result.device_name || 'This Device');
        setMessage(`Welcome ${result.user?.name || 'back'}! Your device has been activated.`);
        
        console.log('✅ Activation successful, forcing auth context refresh');
        
        // Force AuthContext to re-initialize by triggering a re-evaluation
        // The auth context should automatically detect the new state
        
        // Redirect to main app after 2 seconds
        setTimeout(() => {
          console.log('🚀 Activation successful, navigating to main app');
          router.replace('/(tabs)');
        }, 2000);
      } else {
        // Check if already activated
        if (result.error?.includes('already activated') || result.error?.includes('already active')) {
          setActivationState('already_activated');
          setMessage('Your device is already activated! Redirecting to the app...');
          
          setTimeout(() => {
            console.log('🚀 Already activated, navigating to main app');
            router.replace('/(tabs)');
          }, 1500);
        } else {
          setActivationState('error');
          setMessage(result.error || 'Activation failed. Please try again or request a new activation link.');
        }
      }
    } catch (error) {
      console.error('Activation error:', error);
      setActivationState('error');
      setMessage('An unexpected error occurred. Please try again.');
    }
  };

  const handleRetry = () => {
    router.replace('/(auth)/magic-link');
  };

  const getIconAndColor = () => {
    switch (activationState) {
      case 'loading':
        return { icon: 'hourglass-outline', color: colors.saffron[500] };
      case 'success':
        return { icon: 'checkmark-circle', color: colors.green[500] };
      case 'already_activated':
        return { icon: 'checkmark-done-circle', color: colors.green[600] };
      case 'error':
        return { icon: 'close-circle', color: colors.red[500] };
      default:
        return { icon: 'hourglass-outline', color: colors.saffron[500] };
    }
  };

  const { icon, color } = getIconAndColor();

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.cream[50], colors.cream[100]]}
        style={styles.background}
      >
        <Animated.View 
          style={[
            styles.content,
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          {/* Status Icon */}
          <View style={styles.iconContainer}>
            <Animated.View 
              style={[
                styles.iconBackground,
                { borderColor: color },
                activationState === 'loading' && { transform: [{ rotate: spin }] }
              ]}
            >
              {activationState === 'loading' ? (
                <ActivityIndicator size={48} color={color} />
              ) : (
                <Ionicons 
                  name={icon as any} 
                  size={48} 
                  color={color} 
                />
              )}
            </Animated.View>
          </View>

          {/* Status Message */}
          <View style={styles.messageContainer}>
            <Text style={[styles.title, { color }]}>
              {activationState === 'loading' && 'Activating Device'}
              {activationState === 'success' && 'Activation Successful!'}
              {activationState === 'already_activated' && 'Already Activated'}
              {activationState === 'error' && 'Activation Failed'}
            </Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          {/* Success Details */}
          {(activationState === 'success' || activationState === 'already_activated') && (
            <View style={styles.successContainer}>
              <View style={styles.successDetail}>
                <Ionicons name="person-circle-outline" size={20} color={colors.gray[600]} />
                <Text style={styles.successText}>
                  Signed in as <Text style={styles.successBold}>{userName}</Text>
                </Text>
              </View>
              {deviceName && (
                <View style={styles.successDetail}>
                  <Ionicons name="phone-portrait-outline" size={20} color={colors.gray[600]} />
                  <Text style={styles.successText}>
                    Device: <Text style={styles.successBold}>{deviceName}</Text>
                  </Text>
                </View>
              )}
              <View style={styles.redirectNote}>
                <Text style={styles.redirectText}>
                  🎉 Redirecting to the app...
                </Text>
              </View>
            </View>
          )}

          {/* Error Actions */}
          {activationState === 'error' && (
            <View style={styles.errorContainer}>
              <View style={styles.errorDetail}>
                <Ionicons name="information-circle-outline" size={20} color={colors.gray[600]} />
                <Text style={styles.errorText}>
                  The activation link may have expired or been used already.
                </Text>
              </View>
              
              <View style={styles.actionButtons}>
                <Animated.View style={styles.retryButton}>
                  <LinearGradient
                    colors={[colors.burgundy[500], colors.burgundy[600]]}
                    style={styles.buttonGradient}
                  >
                    <Ionicons name="refresh" size={18} color="white" />
                    <Text 
                      style={styles.retryButtonText}
                      onPress={handleRetry}
                    >
                      Request New Link
                    </Text>
                  </LinearGradient>
                </Animated.View>
              </View>
            </View>
          )}

          {/* Loading Details */}
          {activationState === 'loading' && (
            <View style={styles.loadingDetails}>
              <Text style={styles.loadingText}>
                Please wait while we verify your activation link...
              </Text>
            </View>
          )}
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
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 40,
  },
  iconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 3,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Georgia',
  },
  message: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  successContainer: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  successDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: colors.green[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 200,
  },
  successText: {
    fontSize: 14,
    color: colors.gray[600],
    marginLeft: 12,
  },
  successBold: {
    fontWeight: '600',
    color: colors.gray[700],
  },
  redirectNote: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.cream[200],
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.green[500],
  },
  redirectText: {
    fontSize: 14,
    color: colors.gray[600],
    textAlign: 'center',
    fontWeight: '500',
  },
  errorContainer: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  errorDetail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.red[500],
    shadowColor: colors.red[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorText: {
    fontSize: 14,
    color: colors.gray[600],
    marginLeft: 12,
    lineHeight: 20,
    flex: 1,
  },
  actionButtons: {
    alignSelf: 'stretch',
  },
  retryButton: {
    borderRadius: 50,
    shadowColor: colors.burgundy[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 50,
    minHeight: 52,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingDetails: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.cream[200],
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.saffron[500],
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 20,
  },
});