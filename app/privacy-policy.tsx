import React from 'react';
import { ScrollView, Text, View, StyleSheet, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();

  const lastUpdated = language === 'pt' ? '2 de março de 2026' : 'March 2, 2026';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.gray[700]} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('privacy.title') || 'Privacy Policy'}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.orgName}>Associação Padmakara Portugal</Text>
        <Text style={styles.lastUpdated}>
          {t('privacy.lastUpdated') || 'Last updated'}: {lastUpdated}
        </Text>

        {/* Introduction */}
        <Text style={styles.body}>
          {t('privacy.intro') || 'The Padmakara app ("the App") is operated by Associação Padmakara Portugal ("we", "us"). This policy describes how we collect, use, and protect your personal data when you use the App.'}
        </Text>

        {/* 1. Data We Collect */}
        <Text style={styles.sectionTitle}>
          {t('privacy.section1Title') || '1. Data We Collect'}
        </Text>

        <Text style={styles.subtitle}>
          {t('privacy.accountDataTitle') || 'Account Information'}
        </Text>
        <Text style={styles.body}>
          {t('privacy.accountData') || 'When you create an account, we collect your email address, name, and optionally your dharma name. We use a passwordless authentication system (magic links sent to your email).'}
        </Text>

        <Text style={styles.subtitle}>
          {t('privacy.usageDataTitle') || 'Usage Data'}
        </Text>
        <Text style={styles.body}>
          {t('privacy.usageData') || 'To provide a seamless listening experience, the App stores your listening progress (track position and completion status), bookmarks, and notes. This data is synced across your devices via our server.'}
        </Text>

        <Text style={styles.subtitle}>
          {t('privacy.deviceDataTitle') || 'Device Data'}
        </Text>
        <Text style={styles.body}>
          {t('privacy.deviceData') || 'We store a device identifier to manage device activation. If you enable biometric authentication (Face ID, fingerprint), this is handled entirely by your device — we never receive or store biometric data.'}
        </Text>

        <Text style={styles.subtitle}>
          {t('privacy.localDataTitle') || 'Locally Stored Data'}
        </Text>
        <Text style={styles.body}>
          {t('privacy.localData') || 'The App caches audio files and PDF transcripts on your device for offline access. Your language preferences and cache settings are also stored locally. This data never leaves your device.'}
        </Text>

        {/* 2. How We Use Your Data */}
        <Text style={styles.sectionTitle}>
          {t('privacy.section2Title') || '2. How We Use Your Data'}
        </Text>
        <Text style={styles.body}>
          {t('privacy.howWeUse') || 'We use your data exclusively to:\n\n• Authenticate your identity and manage access to retreat recordings\n• Sync your listening progress, bookmarks, and notes across devices\n• Provide content appropriate to your retreat group membership\n• Remember your language and playback preferences\n\nWe do not use your data for advertising, profiling, or any purpose unrelated to the App.'}
        </Text>

        {/* 3. Third-Party Services */}
        <Text style={styles.sectionTitle}>
          {t('privacy.section3Title') || '3. Third-Party Services'}
        </Text>
        <Text style={styles.body}>
          {t('privacy.thirdParty') || 'Audio and transcript files are hosted on Amazon Web Services (AWS S3) in the EU (eu-west-1 region). Access is secured through time-limited signed URLs.\n\nThe App does not include any advertising SDKs, analytics trackers, or crash reporting services. We do not share your data with any third party for marketing or commercial purposes.'}
        </Text>

        {/* 4. Data Retention */}
        <Text style={styles.sectionTitle}>
          {t('privacy.section4Title') || '4. Data Retention'}
        </Text>
        <Text style={styles.body}>
          {t('privacy.retention') || 'We retain your account data for as long as your account is active. Listening progress and bookmarks are kept for the lifetime of your account to preserve your practice history.\n\nLocally cached audio and transcripts can be removed at any time from the Settings screen.'}
        </Text>

        {/* 5. Your Rights */}
        <Text style={styles.sectionTitle}>
          {t('privacy.section5Title') || '5. Your Rights'}
        </Text>
        <Text style={styles.body}>
          {t('privacy.rights') || 'Under the General Data Protection Regulation (GDPR), you have the right to:\n\n• Access — request a copy of all data we hold about you\n• Rectification — correct any inaccurate personal data\n• Erasure — request permanent deletion of your account and all associated data\n• Portability — receive your data in a structured, machine-readable format\n\nTo exercise any of these rights, contact us at the address below. We will respond within 30 days.'}
        </Text>

        {/* 6. Data Security */}
        <Text style={styles.sectionTitle}>
          {t('privacy.section6Title') || '6. Data Security'}
        </Text>
        <Text style={styles.body}>
          {t('privacy.security') || 'All communication between the App and our servers uses HTTPS encryption. Authentication tokens are stored securely on your device. We do not store passwords — access is managed through time-limited magic links.'}
        </Text>

        {/* 7. Children */}
        <Text style={styles.sectionTitle}>
          {t('privacy.section7Title') || "7. Children's Privacy"}
        </Text>
        <Text style={styles.body}>
          {t('privacy.children') || 'The App is not directed at children under the age of 16. We do not knowingly collect personal data from children.'}
        </Text>

        {/* 8. Changes */}
        <Text style={styles.sectionTitle}>
          {t('privacy.section8Title') || '8. Changes to This Policy'}
        </Text>
        <Text style={styles.body}>
          {t('privacy.changes') || 'We may update this policy from time to time. Significant changes will be communicated through the App. The "last updated" date at the top reflects the most recent revision.'}
        </Text>

        {/* 9. Contact */}
        <Text style={styles.sectionTitle}>
          {t('privacy.section9Title') || '9. Contact Us'}
        </Text>
        <Text style={styles.body}>
          {t('privacy.contact') || 'If you have questions about this privacy policy or wish to exercise your data rights, please contact:'}
        </Text>
        <Text style={styles.contactInfo}>
          Associação Padmakara Portugal{'\n'}
          Email: padmakara.portugal@gmail.com
        </Text>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[200],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.cream[200],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.gray[800],
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  orgName: {
    fontSize: 14,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 14,
    color: colors.gray[500],
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[800],
    marginTop: 28,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray[700],
    marginTop: 16,
    marginBottom: 6,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.gray[600],
    marginBottom: 8,
  },
  contactInfo: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.gray[700],
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 8,
  },
  bottomSpacer: {
    height: 60,
  },
});
