import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

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

export default function ApprovalPendingScreen() {
  const { email, name } = useLocalSearchParams<{ email: string; name: string }>();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
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

    // Floating animation for hourglass icon
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();

    return () => floatLoop.stop();
  }, []);

  const handleBackToHome = () => {
    router.push('/(auth)/magic-link');
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
            { 
              opacity: fadeAnim,
              transform: [{ scale: successScale }]
            }
          ]}
        >
          {/* Floating Hourglass Icon */}
          <Animated.View 
            style={[
              styles.iconContainer,
              { transform: [{ translateY: floatAnim }] }
            ]}
          >
            <View style={styles.iconBackground}>
              <Ionicons 
                name="hourglass-outline" 
                size={48} 
                color={colors.saffron[500]} 
              />
            </View>
          </Animated.View>

          {/* Message Container */}
          <View style={styles.messageContainer}>
            <Text style={styles.title}>Request Submitted</Text>
            <Text style={styles.subtitle}>
              Thank you, {name}. Your request has been sent to our community administrators for review.
            </Text>
          </View>

          {/* Status Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Ionicons 
                name="time-outline" 
                size={20} 
                color={colors.saffron[500]} 
              />
              <Text style={styles.statusTitle}>What happens next?</Text>
            </View>
            
            <View style={styles.statusSteps}>
              <View style={styles.step}>
                <View style={styles.stepDot} />
                <Text style={styles.stepText}>
                  Our team will review your request within 24-48 hours
                </Text>
              </View>
              
              <View style={styles.step}>
                <View style={styles.stepDot} />
                <Text style={styles.stepText}>
                  You'll receive an email once your access is approved
                </Text>
              </View>
              
              <View style={styles.step}>
                <View style={styles.stepDot} />
                <Text style={styles.stepText}>
                  Return to this app and enter your email to activate your device
                </Text>
              </View>
            </View>
          </View>

          {/* Contact Info */}
          <View style={styles.contactCard}>
            <Ionicons 
              name="heart" 
              size={16} 
              color={colors.burgundy[500]} 
            />
            <Text style={styles.contactText}>
              We appreciate your interest in joining our dharma community. 
              If you have any questions, please feel free to contact us.
            </Text>
          </View>

          {/* Email Reminder */}
          <View style={styles.emailReminder}>
            <Text style={styles.emailLabel}>Your request email:</Text>
            <Text style={styles.emailText}>{email}</Text>
          </View>

          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToHome}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.gray[500], colors.gray[600]]}
              style={styles.buttonGradient}
            >
              <Ionicons name="arrow-back" size={18} color="white" />
              <Text style={styles.backButtonText}>Back to Login</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Peaceful Message */}
          <View style={styles.peacefulMessage}>
            <Text style={styles.peacefulText}>
              🙏 May you find peace while you wait
            </Text>
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
  iconContainer: {
    marginBottom: 32,
  },
  iconBackground: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.saffron[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 3,
    borderColor: colors.cream[200],
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 32,
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
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignSelf: 'stretch',
    shadowColor: colors.gray[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: colors.saffron[500],
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[700],
    marginLeft: 8,
  },
  statusSteps: {
    space: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.saffron[500],
    marginTop: 6,
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: colors.gray[600],
    lineHeight: 22,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.cream[200],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  contactText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray[600],
    lineHeight: 20,
    marginLeft: 8,
  },
  emailReminder: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emailLabel: {
    fontSize: 14,
    color: colors.gray[500],
    marginBottom: 4,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  backButton: {
    borderRadius: 50,
    marginBottom: 20,
    shadowColor: colors.gray[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    alignSelf: 'stretch',
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
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  peacefulMessage: {
    alignItems: 'center',
  },
  peacefulText: {
    fontSize: 16,
    color: colors.gray[500],
    fontStyle: 'italic',
    textAlign: 'center',
  },
});