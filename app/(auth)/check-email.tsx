import { useAuth } from '@/contexts/AuthContext';
import magicLinkService from '@/services/magicLinkService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
};

export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { isAuthenticated, isDeviceActivated, refreshAuth } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isPolling, setIsPolling] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const [activationStatus, setActivationStatus] = useState<'checking' | 'pending' | 'activated' | 'error'>('checking');
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(successScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for email icon
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, []);

  useEffect(() => {
    // Cooldown timer
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Check if already authenticated (including detection of token activation)
  useEffect(() => {
    if (isAuthenticated && isDeviceActivated) {
      console.log('✅ User authenticated via AuthContext state change, redirecting to main app');
      setActivationStatus('activated');
      setIsPolling(false); // Stop polling when activation detected via AuthContext
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1000);
    }
  }, [isAuthenticated, isDeviceActivated]);


  // Polling mechanism to check activation status
  useEffect(() => {
    if (!isPolling) return;

    const checkActivationStatus = async () => {
      try {
        console.log(`🔍 Polling activation status (attempt ${pollCount + 1})`);
        const result = await magicLinkService.checkActivationStatus();
        
        if (result.success && result.data) {
          if (result.data.isActivated) {
            console.log('🎉 Device activation detected via polling!');
            setActivationStatus('activated');
            setIsPolling(false);
            
            // Refresh AuthContext to pick up the activation
            console.log('🔄 Refreshing AuthContext after activation detection');
            await refreshAuth();
            
            // Give a moment for the user to see the success state
            setTimeout(() => {
              router.replace('/(tabs)');
            }, 2000);
          } else {
            setActivationStatus('pending');
            setPollCount(prev => prev + 1);
          }
        } else {
          // Don't show error for failed polls, just continue polling
          console.warn('Activation status check failed:', result.error);
          setActivationStatus('pending');
          setPollCount(prev => prev + 1);
        }
      } catch (error) {
        console.error('Error checking activation status:', error);
        setActivationStatus('pending');
        setPollCount(prev => prev + 1);
      }
    };

    // Start polling after a 2 second delay to give the user time to open their email
    const initialDelay = setTimeout(() => {
      checkActivationStatus();
    }, 2000);

    // Continue polling every 4 seconds for up to 10 minutes (150 attempts)
    const pollingInterval = setInterval(() => {
      if (pollCount < 150) { // Max 10 minutes of polling
        checkActivationStatus();
      } else {
        console.log('📱 Polling timeout reached, stopping automatic checks');
        setIsPolling(false);
        setActivationStatus('pending');
      }
    }, 4000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(pollingInterval);
    };
  }, [isPolling, pollCount]);

  // Manual activation status check
  const handleCheckStatus = async () => {
    if (isResending) return;
    
    setIsResending(true);
    setActivationStatus('checking');
    
    try {
      const result = await magicLinkService.checkActivationStatus();
      
      if (result.success && result.data) {
        if (result.data.isActivated) {
          setActivationStatus('activated');
          
          // Refresh AuthContext to pick up the activation
          console.log('🔄 Refreshing AuthContext after manual status check');
          await refreshAuth();
          
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 1500);
        } else {
          setActivationStatus('pending');
          Alert.alert(
            'Not Activated Yet',
            'Your device hasn\'t been activated yet. Please check your email and click the activation link.',
            [{ text: 'OK' }]
          );
        }
      } else {
        setActivationStatus('error');
        Alert.alert('Error', result.error || 'Failed to check activation status');
      }
    } catch (error) {
      setActivationStatus('error');
      Alert.alert('Error', 'Network error checking activation status');
    } finally {
      setIsResending(false);
    }
  };

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;

    setIsResending(true);

    try {
      const result = await magicLinkService.requestMagicLink(email);

      if (result.success) {
        Alert.alert(
          'Email sent!',
          'We\'ve sent you a new activation link. Please check your email.',
          [{ text: 'OK' }]
        );
        setResendCooldown(60); // 60 second cooldown
      } else {
        Alert.alert('Error', result.error || 'Failed to resend email. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToEmail = () => {
    router.back();
  };

  const formatEmail = (email: string) => {
    // Show full email address - it's not a security risk in this context
    // since the user just entered it themselves
    return email || '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.cream[50], colors.cream[100]]}
        style={styles.background}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={[
              styles.content,
              { 
                opacity: fadeAnim,
                transform: [{ scale: successScale }]
              }
            ]}
          >
          {/* Email Icon with Pulse Animation */}
          <Animated.View 
            style={[
              styles.iconContainer,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <View style={styles.iconBackground}>
              <Ionicons 
                name="mail" 
                size={48} 
                color={colors.burgundy[500]} 
              />
            </View>
          </Animated.View>

          {/* Success Message with Status */}
          <View style={styles.messageContainer}>
            <Text style={styles.title}>
              {activationStatus === 'activated' ? 'Activation Successful!' :
               activationStatus === 'checking' ? 'Checking Status...' :
               'Check your email'}
            </Text>
            <Text style={styles.subtitle}>
              {activationStatus === 'activated' ? 'Welcome! Redirecting to the app...' :
               activationStatus === 'checking' ? 'Verifying your device activation...' :
               'We\'ve sent an activation link to'}
            </Text>
            {activationStatus !== 'activated' && activationStatus !== 'checking' && (
              <Text style={styles.emailText}>{formatEmail(email || '')}</Text>
            )}
            
            {/* Live Status Indicator */}
            {isPolling && activationStatus === 'pending' && (
              <View style={styles.statusIndicator}>
                <ActivityIndicator size="small" color={colors.saffron[500]} />
                <Text style={styles.statusText}>
                  Waiting for activation...
                </Text>
              </View>
            )}
            
            {activationStatus === 'activated' && (
              <View style={styles.successIndicator}>
                <Ionicons name="checkmark-circle" size={20} color={colors.burgundy[500]} />
                <Text style={styles.successStatusText}>Device activated successfully!</Text>
              </View>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <View style={styles.stepsContainer}>
              <View style={styles.instruction}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepText}>1</Text>
                </View>
                <Text style={styles.instructionText}>
                  Check your email for the activation link
                </Text>
              </View>

              <View style={styles.instruction}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepText}>2</Text>
                </View>
                <Text style={styles.instructionText}>
                  Tap the activation button in the email
                </Text>
              </View>

              <View style={styles.instruction}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepText}>3</Text>
                </View>
                <Text style={styles.instructionText}>
                  You'll be automatically signed in
                </Text>
              </View>
            </View>
          </View>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Ionicons 
              name="shield-checkmark" 
              size={16} 
              color={colors.saffron[500]} 
            />
            <Text style={styles.securityText}>
              The link expires in 1 hour for your security
            </Text>
          </View>

          {/* Action Buttons */}
          {activationStatus !== 'activated' && (
            <View style={styles.actionContainer}>
              {/* Check Status Button - More prominent than resend */}
              <TouchableOpacity
                style={[
                  styles.checkStatusButton, 
                  isResending && styles.buttonDisabled
                ]}
                onPress={handleCheckStatus}
                disabled={isResending}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.burgundy[500], colors.burgundy[600]]}
                  style={styles.buttonGradient}
                >
                  {isResending && activationStatus === 'checking' ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="search" size={18} color="white" />
                      <Text style={styles.checkStatusButtonText}>
                        Check Status
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Resend Button - Secondary */}
              <TouchableOpacity
                style={[
                  styles.resendButton, 
                  (isResending || resendCooldown > 0) && styles.buttonDisabled
                ]}
                onPress={handleResend}
                disabled={isResending || resendCooldown > 0}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.saffron[500], colors.saffron[600]]}
                  style={styles.buttonGradient}
                >
                  {isResending && activationStatus !== 'checking' ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={18} color="white" />
                      <Text style={styles.resendButtonText}>
                        {resendCooldown > 0 
                          ? `Resend in ${resendCooldown}s`
                          : 'Resend email'
                        }
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Change Email Button */}
              <TouchableOpacity
                style={styles.changeEmailButton}
                onPress={handleBackToEmail}
                activeOpacity={0.7}
              >
                <Text style={styles.changeEmailText}>Change email address</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Helpful Tip */}
          <View style={styles.tipContainer}>
            <Text style={styles.tipText}>
              💡 <Text style={styles.tipBold}>Tip:</Text> If you don't see the email, 
              check your spam or junk folder, or try adding our domain to your safe sender list.
            </Text>
          </View>
        </Animated.View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: '100%',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconBackground: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.burgundy[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 3,
    borderColor: colors.cream[200],
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.burgundy[500],
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Georgia',
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.burgundy[500],
    textAlign: 'center',
  },
  instructionsContainer: {
    alignSelf: 'stretch',
    marginBottom: 16,
    alignItems: 'center',
  },
  stepsContainer: {
    maxWidth: 300,
    width: '100%',
  },
  instruction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.burgundy[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray[700],
    lineHeight: 20,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream[200],
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: colors.saffron[500],
  },
  securityText: {
    fontSize: 14,
    color: colors.gray[600],
    marginLeft: 8,
    fontWeight: '500',
  },
  actionContainer: {
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  resendButton: {
    borderRadius: 50,
    marginBottom: 16,
    shadowColor: colors.saffron[500],
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
  resendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  changeEmailButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  changeEmailText: {
    color: colors.gray[500],
    fontSize: 16,
    fontWeight: '600',
  },
  tipContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.cream[200],
  },
  tipText: {
    fontSize: 13,
    color: colors.gray[600],
    lineHeight: 18,
    textAlign: 'center',
  },
  tipBold: {
    fontWeight: '600',
    color: colors.gray[700],
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cream[200],
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.saffron[500],
  },
  statusText: {
    fontSize: 14,
    color: colors.gray[600],
    marginLeft: 8,
    fontWeight: '500',
  },
  successIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.burgundy[500],
    shadowColor: colors.burgundy[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  successStatusText: {
    fontSize: 14,
    color: colors.burgundy[500],
    marginLeft: 8,
    fontWeight: '600',
  },
  checkStatusButton: {
    borderRadius: 50,
    marginBottom: 12,
    shadowColor: colors.burgundy[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  checkStatusButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});