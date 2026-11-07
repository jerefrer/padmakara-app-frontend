import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import magicLinkService from '@/services/magicLinkService';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '@/components/ui/BackButton';
import { PasskeySignInButton } from '@/components/auth/PasskeySignInButton';
import { usePasskeyAutofill } from '@/hooks/usePasskeyAutofill';
import { markEmailSignIn } from '@/hooks/passkeyInviteState';
import { safeInternalPath } from '@/utils/safeInternalPath';

const colors = {
  cream: {
    50: '#ffffff',
    100: '#fefefe',
    200: '#f5f4f2',
  },
  burgundy: {
    500: '#9b1b1b',
    600: '#7b1616',
    700: '#5a1111',
  },
  saffron: {
    500: '#f59e0b',
    600: '#d97706',
  },
  gray: {
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#2c2c2c',
  },
  white: '#ffffff',
};

export default function MagicLinkScreen() {
  const { isAuthenticated, isDeviceActivated, refreshAuth } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { returnTo, email: emailParam } = useLocalSearchParams<{ returnTo?: string; email?: string }>();
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  const redirectTarget = safeInternalPath(returnTo) as any;
  const [email, setEmail] = useState(typeof emailParam === 'string' ? emailParam : '');
  const [isLoading, setIsLoading] = useState(false);
  // Store-review account: the server asks for a code instead of emailing a link.
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [reviewCode, setReviewCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  // The redirect effect below takes over once refreshAuth has run; only the email step offers autofill.
  const { abort: abortAutofill } = usePasskeyAutofill(() => {}, !showCodeForm);
  
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
        router.replace(redirectTarget);
      }, 100);
    }
  }, [isAuthenticated, isDeviceActivated]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      Alert.alert(t('auth.magicLink.emailRequired'), t('auth.magicLink.emailRequiredMessage'));
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert(t('auth.magicLink.invalidEmail'), t('auth.magicLink.invalidEmailMessage'));
      return;
    }

    abortAutofill();
    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const result = await magicLinkService.requestMagicLink(email.trim(), language);

      if (!result.success) {
        Alert.alert(t('auth.magicLink.errorTitle'), result.error || 'Failed to process your request. Please try again.');
        return;
      }

      const { status, message: responseMessage } = result.data!;

      switch (status) {
        case 'already_activated':
          // Device already activated — refresh auth state.
          // The useEffect on [isAuthenticated, isDeviceActivated] handles the redirect,
          // so do NOT call router.replace here (would cause a double navigation animation).
          console.log('🎉 Device already activated, refreshing auth state');
          markEmailSignIn();
          await refreshAuth();
          return; // Exit early to prevent further processing

        case 'magic_link_sent':
          // Show success message and redirect to waiting screen
          router.push({
            pathname: '/(auth)/check-email',
            params: { email: email.trim(), returnTo: redirectTarget }
          });
          break;

        case 'code_required':
          setReviewCode('');
          setCodeError(false);
          setShowCodeForm(true);
          break;

        default:
          Alert.alert(t('auth.magicLink.errorTitle'), responseMessage || 'Unexpected response from server.');
      }
    } catch (error) {
      console.error('Magic link request error:', error);
      Alert.alert(t('auth.magicLink.networkErrorTitle'), t('auth.magicLink.networkErrorMessage'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    const value = reviewCode.trim();
    if (value.length < 6 || value.length > 12) {
      setCodeError(true);
      return;
    }
    setCodeError(false);
    setIsLoading(true);
    Keyboard.dismiss();
    try {
      const result = await magicLinkService.reviewLogin(email.trim(), value);
      if (result.success) {
        // The useEffect on [isAuthenticated, isDeviceActivated] handles the redirect.
        markEmailSignIn();
        await refreshAuth();
      } else if (result.incorrectCode) {
        setCodeError(true);
      } else {
        Alert.alert(t('auth.magicLink.errorTitle'), result.error || 'Failed to process your request. Please try again.');
      }
    } catch (error) {
      Alert.alert(t('auth.magicLink.networkErrorTitle'), t('auth.magicLink.networkErrorMessage'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderLanguageSwitcher = () => (
    <View style={styles.languageSwitcherContainer}>
      <TouchableOpacity
        style={styles.languageButton}
        onPress={() => setShowLanguageDropdown(!showLanguageDropdown)}
        disabled={isLoading}
      >
        <Text style={styles.languageButtonText}>
          {t('auth.magicLink.language')}: {language === 'en' ? t('auth.magicLink.english') : t('auth.magicLink.portuguese')}
        </Text>
        <Text style={styles.languageArrow}>{showLanguageDropdown ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      
      {showLanguageDropdown && (
        <View style={styles.languageDropdown}>
          <TouchableOpacity
            style={[styles.languageOption, language === 'en' && styles.languageOptionSelected]}
            onPress={() => {
              setLanguage('en');
              setShowLanguageDropdown(false);
            }}
          >
            <Text style={[styles.languageOptionText, language === 'en' && styles.languageOptionTextSelected]}>
              {t('auth.magicLink.english')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.languageOption, language === 'pt' && styles.languageOptionSelected]}
            onPress={() => {
              setLanguage('pt');
              setShowLanguageDropdown(false);
            }}
          >
            <Text style={[styles.languageOptionText, language === 'pt' && styles.languageOptionTextSelected]}>
              {t('auth.magicLink.portuguese')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderBackButton = () => (
    <BackButton
      variant="inline"
      style={styles.backButton}
      disabled={isLoading}
      onPress={() => {
        if (canGoBack) {
          router.back();
        } else {
          router.replace('/(tabs)/(groups)');
        }
      }}
    />
  );

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
      {renderBackButton()}
      {renderLanguageSwitcher()}
      
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
        <Text style={styles.title}>{t('auth.magicLink.title')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.magicLink.subtitle')}
        </Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.magicLink.emailPlaceholder')}
            placeholderTextColor={colors.gray[400]}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={Platform.OS === 'web' ? ('username webauthn' as any) : 'email'}
            editable={!isLoading}
            onSubmitEditing={handleEmailSubmit}
            returnKeyType="go"
          />
          <Text style={styles.deviceHint}>
            {t('auth.signInPanel.hint') || "If this device isn't recognised, we'll email you a link."}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleEmailSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>{t('auth.magicLink.continueButton')}</Text>
          )}
        </TouchableOpacity>
        <PasskeySignInButton onStart={abortAutofill} />
      </View>

    </Animated.View>
  );

  const renderCodeForm = () => (
    <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>{t('auth.signInPanel.codeLabel') || 'Review code'}</Text>
        <Text style={styles.subtitle}>
          {t('auth.signInPanel.codeHelp') || 'This account signs in with a code provided to app reviewers.'}
        </Text>
      </View>
      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            testID="review-code-input"
            style={styles.textInput}
            value={reviewCode}
            onChangeText={setReviewCode}
            maxLength={12}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            onSubmitEditing={handleCodeSubmit}
            returnKeyType="go"
          />
          {codeError ? (
            <Text testID="review-code-error" style={styles.deviceHint}>
              {t('auth.signInPanel.codeIncorrect') || 'Incorrect code'}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          testID="review-code-submit"
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleCodeSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>{t('auth.magicLink.continueButton')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowCodeForm(false)} disabled={isLoading}>
          <Text style={styles.secondaryButtonText}>{t('navigation.back') || 'Back'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.background}>
        {showCodeForm ? renderCodeForm() : renderEmailForm()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  background: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.gray[800],
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'MinionPro',
    fontVariant: ['small-caps'],
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  deviceHint: { fontSize: 13, lineHeight: 18, color: colors.gray[500], marginTop: 8 },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: colors.white,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.gray[700],
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  primaryButton: {
    backgroundColor: colors.burgundy[500],
    borderRadius: 2,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 12,
    marginBottom: 24,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: colors.gray[500],
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    position: 'absolute',
    top: 14,
    left: 10,
    zIndex: 10,
    marginLeft: 0,
  },
  languageSwitcherContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  languageButtonText: {
    fontSize: 13,
    color: colors.gray[600],
    fontWeight: '500',
    marginRight: 6,
  },
  languageArrow: {
    fontSize: 10,
    color: colors.gray[400],
  },
  languageDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: colors.white,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 120,
    marginTop: 4,
  },
  languageOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  languageOptionSelected: {
    backgroundColor: colors.cream[100],
  },
  languageOptionText: {
    fontSize: 14,
    color: colors.gray[700],
    fontWeight: '500',
  },
  languageOptionTextSelected: {
    color: colors.burgundy[500],
    fontWeight: '600',
  },
});