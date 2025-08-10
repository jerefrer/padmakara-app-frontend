import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

const colors = {
  cream: {
    50: '#fefdfb',
    100: '#fcf8f3',
  },
  burgundy: {
    500: '#b91c1c',
  },
  saffron: {
    500: '#f59e0b',
  },
  gray: {
    600: '#4b5563',
  },
  red: {
    500: '#ef4444',
  },
};

export default function ActivateTokenScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { activateDeviceWithToken } = useAuth();
  
  const [isActivating, setIsActivating] = useState(true);
  const [activationStatus, setActivationStatus] = useState<'activating' | 'success' | 'error'>('activating');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Spinning animation for loading
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    spinLoop.start();

    if (token) {
      handleActivation(token);
    } else {
      setActivationStatus('error');
      setErrorMessage('Invalid activation link');
      setIsActivating(false);
    }

    return () => spinLoop.stop();
  }, [token]);

  const handleActivation = async (activationToken: string) => {
    try {
      console.log('Processing magic link activation with token:', activationToken);
      
      const result = await activateDeviceWithToken(activationToken);
      
      if (result.success && result.user) {
        setActivationStatus('success');
        setIsActivating(false);
        
        // Show success briefly, then navigate to success screen
        setTimeout(() => {
          router.replace({
            pathname: '/(auth)/device-activated',
            params: { 
              user_name: result.user?.first_name || result.user?.name || 'there',
              device_name: result.device_name || 'This Device'
            }
          });
        }, 1500);
      } else {
        setActivationStatus('error');
        setErrorMessage(result.error || 'Device activation failed. The link may have expired or already been used.');
        setIsActivating(false);
        
        // Show error briefly, then navigate back to login
        setTimeout(() => {
          Alert.alert(
            'Activation Failed',
            result.error || 'The activation link is invalid or has expired. Please request a new one.',
            [
              { 
                text: 'Try Again', 
                onPress: () => router.replace('/(auth)/magic-link') 
              }
            ]
          );
        }, 2000);
      }
    } catch (error) {
      console.error('Activation error:', error);
      setActivationStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
      setIsActivating(false);
      
      setTimeout(() => {
        Alert.alert(
          'Connection Error',
          'Unable to connect to the server. Please check your internet connection and try again.',
          [
            { 
              text: 'Retry', 
              onPress: () => router.replace('/(auth)/magic-link') 
            }
          ]
        );
      }, 2000);
    }
  };

  const getStatusIcon = () => {
    switch (activationStatus) {
      case 'activating':
        return (
          <Animated.View
            style={{
              transform: [{
                rotate: spinAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                })
              }]
            }}
          >
            <Ionicons name="sync" size={48} color={colors.saffron[500]} />
          </Animated.View>
        );
      case 'success':
        return <Ionicons name="checkmark-circle" size={48} color={colors.saffron[500]} />;
      case 'error':
        return <Ionicons name="close-circle" size={48} color={colors.red[500]} />;
      default:
        return <ActivityIndicator size="large" color={colors.saffron[500]} />;
    }
  };

  const getStatusMessage = () => {
    switch (activationStatus) {
      case 'activating':
        return {
          title: 'Activating Your Device',
          subtitle: 'Please wait while we securely activate your device...'
        };
      case 'success':
        return {
          title: 'Device Activated!',
          subtitle: 'Welcome to Padmakara. Redirecting to your account...'
        };
      case 'error':
        return {
          title: 'Activation Failed',
          subtitle: errorMessage
        };
      default:
        return {
          title: 'Processing',
          subtitle: 'Please wait...'
        };
    }
  };

  const statusMessage = getStatusMessage();

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
          {/* Status Icon */}
          <View style={styles.iconContainer}>
            <View style={[
              styles.iconBackground,
              activationStatus === 'error' && styles.errorIconBackground
            ]}>
              {getStatusIcon()}
            </View>
          </View>

          {/* Status Message */}
          <View style={styles.messageContainer}>
            <Text style={[
              styles.title,
              activationStatus === 'error' && styles.errorTitle
            ]}>
              {statusMessage.title}
            </Text>
            <Text style={styles.subtitle}>
              {statusMessage.subtitle}
            </Text>
          </View>

          {/* Progress Indicator for Activating State */}
          {activationStatus === 'activating' && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill,
                    {
                      width: spinAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['20%', '80%']
                      })
                    }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                Establishing secure connection...
              </Text>
            </View>
          )}

          {/* Additional Info */}
          {activationStatus !== 'error' && (
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>
                🔒 Your device is being securely registered for future access
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
    paddingTop: 100,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 40,
  },
  iconBackground: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.saffron[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 3,
    borderColor: colors.cream[100],
  },
  errorIconBackground: {
    shadowColor: colors.red[500],
    borderColor: colors.red[100],
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.burgundy[500],
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Georgia',
  },
  errorTitle: {
    color: colors.red[500],
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  progressBar: {
    width: 200,
    height: 4,
    backgroundColor: colors.cream[100],
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.saffron[500],
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: colors.gray[600],
    fontWeight: '500',
  },
  infoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.cream[100],
  },
  infoText: {
    fontSize: 14,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 20,
  },
});