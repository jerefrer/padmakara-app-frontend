import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import magicLinkService from '@/services/magicLinkService';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const colors = {
  cream: {
    50: '#fefdfb',
    100: '#fcf8f3',
    200: '#f7f0e4',
  },
  burgundy: {
    500: '#b91c1c',
    600: '#991b1b',
    700: '#7f1d1d',
  },
  saffron: {
    500: '#f59e0b',
    600: '#d97706',
  },
  gray: {
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

export default function MagicLinkScreen() {
  const { isAuthenticated, isDeviceActivated, refreshAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [message, setMessage] = useState('');
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Check if user is already authenticated and redirect
  useEffect(() => {
    if (isAuthenticated && isDeviceActivated) {
      console.log('✅ User already authenticated, redirecting from magic-link screen');
      // Use a slight delay to prevent conflicts with root index routing
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
    }
  }, [isAuthenticated, isDeviceActivated]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Please enter your email', 'We need your email address to send you the activation link.');
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const result = await magicLinkService.requestMagicLink(email.trim());

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to process your request. Please try again.');
        return;
      }

      const { status, message: responseMessage } = result.data!;

      switch (status) {
        case 'already_activated':
          // Device already activated, refresh auth state then redirect
          console.log('🎉 Device already activated, refreshing auth state and redirecting to main app');
          await refreshAuth();
          router.replace('/(tabs)');
          return; // Exit early to prevent further processing

        case 'magic_link_sent':
          // Show success message and redirect to waiting screen
          router.push({
            pathname: '/(auth)/check-email',
            params: { email: email.trim() }
          });
          break;

        case 'approval_required':
          // Show approval form
          setShowApprovalForm(true);
          break;

        default:
          Alert.alert('Error', responseMessage || 'Unexpected response from server.');
      }
    } catch (error) {
      console.error('Magic link request error:', error);
      Alert.alert('Network Error', 'Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprovalSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required fields', 'Please enter your first and last name.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await magicLinkService.requestApproval({
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        message: message.trim(),
      });

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to submit your request. Please try again.');
        return;
      }

      // Show success and redirect to pending screen
      router.push({
        pathname: '/(auth)/approval-pending',
        params: { 
          email: email.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`
        }
      });
    } catch (error) {
      console.error('Approval request error:', error);
      Alert.alert('Network Error', 'Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderEmailForm = () => (
    <Animated.View 
      style={[
        styles.content,
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <Animated.View 
        style={[
          styles.logoContainer,
          { transform: [{ scale: logoScale }] }
        ]}
      >
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logo}
          contentFit="contain"
        />
      </Animated.View>

      <View style={styles.headerContainer}>
        <Text style={styles.title}>Welcome to Padmakara</Text>
        <Text style={styles.subtitle}>
          Enter your email address to access your retreat recordings and teachings
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Email Address</Text>
        <TextInput
          style={styles.textInput}
          value={email}
          onChangeText={setEmail}
          placeholder="your.email@example.com"
          placeholderTextColor={colors.gray[400]}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          editable={!isLoading}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
        onPress={handleEmailSubmit}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[colors.burgundy[500], colors.burgundy[600]]}
          style={styles.buttonGradient}
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.securityNote}>
        <Text style={styles.securityText}>
          🔒 Secure, passwordless authentication for your peace of mind
        </Text>
      </View>

      {/* Development Mode Quick Actions */}
      {__DEV__ && (
        <View style={styles.devActions}>
          <Text style={styles.devTitle}>Development Mode</Text>
          <TouchableOpacity
            style={styles.devButton}
            onPress={async () => {
              console.log('🎭 Development mode: Quick activation with local backend');
              setIsLoading(true);
              try {
                // Use development email for quick activation
                const devEmail = 'dev@local.test';
                setEmail(devEmail);
                
                // Request magic link from local backend
                console.log('📧 Requesting magic link from local Django backend...');
                const result = await magicLinkService.requestMagicLink(devEmail);
                
                if (result.success) {
                  console.log('✅ Magic link request successful:', result.data?.status);
                  
                  if (result.data?.status === 'already_activated') {
                    // Already activated, refresh auth and navigate
                    await refreshAuth();
                    router.replace('/(tabs)');
                  } else if (result.data?.status === 'magic_link_sent') {
                    // Magic link sent, show check email screen
                    router.push({
                      pathname: '/(auth)/check-email',
                      params: { email: devEmail }
                    });
                  } else {
                    Alert.alert('Development Note', 'Magic link sent to dev email. Check the Django server logs for the activation link.');
                    router.push({
                      pathname: '/(auth)/check-email',
                      params: { email: devEmail }
                    });
                  }
                } else {
                  console.warn('⚠️ Magic link request failed, but continuing for development');
                  // In development, still show the check email screen
                  Alert.alert('Development Mode', 'Backend request failed, but you can still test the flow. Check Django server logs for any activation links.');
                  router.push({
                    pathname: '/(auth)/check-email',
                    params: { email: devEmail }
                  });
                }
              } catch (error) {
                console.error('🎭 Development activation error:', error);
                Alert.alert('Development Error', 'Failed to connect to local backend. Make sure Django server is running on the expected port.');
              } finally {
                setIsLoading(false);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.devButtonText}>
              🚀 Quick Activate (Dev Only)
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  const renderApprovalForm = () => (
    <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Welcome, New Friend</Text>
        <Text style={styles.subtitle}>
          We'd love to have you join our community. Please provide a few details so our team can approve your access.
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>First Name *</Text>
          <TextInput
            style={styles.textInput}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter your first name"
            placeholderTextColor={colors.gray[400]}
            autoCapitalize="words"
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Last Name *</Text>
          <TextInput
            style={styles.textInput}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter your last name"
            placeholderTextColor={colors.gray[400]}
            autoCapitalize="words"
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Message (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us how you heard about us or any message for our team..."
            placeholderTextColor={colors.gray[400]}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isLoading}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleApprovalSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.saffron[500], colors.saffron[600]]}
            style={styles.buttonGradient}
          >
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Request Access</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setShowApprovalForm(false)}
          disabled={isLoading}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.cream[50], colors.cream[100]]}
        style={styles.background}
      >
        {showApprovalForm ? renderApprovalForm() : renderEmailForm()}
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
    paddingTop: 40,
    paddingBottom: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
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
    paddingHorizontal: 16,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[700],
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.gray[700],
    borderWidth: 2,
    borderColor: colors.cream[200],
    shadowColor: colors.gray[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  primaryButton: {
    borderRadius: 50,
    marginTop: 16,
    marginBottom: 24,
    shadowColor: colors.burgundy[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: colors.gray[500],
    fontSize: 16,
    fontWeight: '600',
  },
  securityNote: {
    backgroundColor: colors.cream[200],
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.saffron[500],
  },
  securityText: {
    color: colors.gray[600],
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  devActions: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(249, 115, 22, 0.1)', // Orange tint for dev mode
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    borderStyle: 'dashed',
  },
  devTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(249, 115, 22, 0.8)',
    textAlign: 'center',
    marginBottom: 12,
  },
  devButton: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  devButtonText: {
    color: 'rgba(249, 115, 22, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});