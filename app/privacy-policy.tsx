import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { pageStyles } from '@/components/membership/pageStyles';
import { membershipColors as c } from '@/components/membership/theme';
import { LegalBody, LegalPage, LegalSection, LegalSubheading } from '@/components/legal/LegalPage';

export default function PrivacyPolicyScreen() {
  const { t, language } = useLanguage();
  const p = (key: string, fallback: string) => t(`privacy.${key}`) || fallback;

  const lastUpdated = p('lastUpdatedDate', language === 'pt' ? '27 de outubro de 2026' : '27 October 2026');
  const deletionUrl = p('rightsDeleteLink', 'https://app.padmakara.pt/account-deletion');

  return (
    <LegalPage title={p('title', 'Privacy Policy')}>
      <Text style={styles.meta}>Associação Padmakara Portugal</Text>
      <Text style={styles.meta}>
        {p('lastUpdated', 'Last updated')}: {lastUpdated}
      </Text>

      <LegalBody style={styles.intro}>
        {p('intro', 'The Padmakara app ("the App") is operated by Associação Padmakara Portugal ("we", "us"). This policy describes how we collect, use, and protect your personal data when you use the App.')}
      </LegalBody>

      <LegalSection title={p('section1Title', '1. Data We Collect')}>
        <LegalSubheading>{p('accountDataTitle', 'Account Information')}</LegalSubheading>
        <LegalBody>{p('accountData', 'When you create an account, we collect your email address, name, and optionally your dharma name. We use a passwordless authentication system (magic links sent to your email).')}</LegalBody>
        <LegalSubheading>{p('usageDataTitle', 'Usage Data')}</LegalSubheading>
        <LegalBody>{p('usageData', 'To provide a seamless listening experience, the App stores your listening progress (track position and completion status), bookmarks, and notes. This data is synced across your devices via our server.')}</LegalBody>
        <LegalSubheading>{p('deviceDataTitle', 'Device Data')}</LegalSubheading>
        <LegalBody>{p('deviceData', 'We store a device identifier to manage device activation. If you enable biometric authentication (Face ID, fingerprint), this is handled entirely by your device — we never receive or store biometric data.')}</LegalBody>
        <LegalSubheading>{p('localDataTitle', 'Locally Stored Data')}</LegalSubheading>
        <LegalBody>{p('localData', 'The App caches audio files and PDF transcripts on your device for offline access. Your language preferences and cache settings are also stored locally. This data never leaves your device.')}</LegalBody>
      </LegalSection>

      <LegalSection title={p('section2Title', '2. How We Use Your Data')}>
        <LegalBody>{p('howWeUse', 'We use your data exclusively to:\n\n• Authenticate your identity and manage access to retreat recordings\n• Sync your listening progress, bookmarks, and notes across devices\n• Provide content appropriate to your retreat group membership\n• Remember your language and playback preferences\n\nWe do not use your data for advertising, profiling, or any purpose unrelated to the App.')}</LegalBody>
      </LegalSection>

      <LegalSection title={p('section3Title', '3. Third-Party Services')}>
        <LegalBody>{p('thirdParty', 'We rely on the following service providers to run the App. Each one only receives what it needs to do its job.')}</LegalBody>
        <LegalSubheading>{p('thirdPartyStorageTitle', 'File storage — Cloudflare R2')}</LegalSubheading>
        <LegalBody>{p('thirdPartyStorage', 'Audio recordings, transcripts and images are stored with Cloudflare R2 and delivered through time-limited signed URLs.')}</LegalBody>
        <LegalSubheading>{p('thirdPartyVideoTitle', 'Video hosting — Bunny Stream')}</LegalSubheading>
        <LegalBody>{p('thirdPartyVideo', 'Retreat videos are hosted and streamed by Bunny Stream (bunny.net). When you watch a video, your device connects to Bunny to receive it, and Bunny sees your IP address like any streaming service.')}</LegalBody>
        <LegalSubheading>{p('thirdPartyEmailTitle', 'Email — Amazon SES')}</LegalSubheading>
        <LegalBody>{p('thirdPartyEmail', 'The emails we send you (sign-in links, account deletion confirmations) are delivered through Amazon Simple Email Service, which receives your email address and the message.')}</LegalBody>
        <LegalSubheading>{p('thirdPartyCrashTitle', 'Crash reporting — Sentry')}</LegalSubheading>
        <LegalBody>{p('thirdPartyCrash', "We use Sentry (sentry.io) for error and crash reporting to improve app stability. Sentry receives only technical data (device type, OS version, error stack traces) and your account number, never your email address. Sentry's privacy policy: https://sentry.io/privacy/")}</LegalBody>
        <LegalSubheading>{p('thirdPartyPaymentsTitle', 'Payments on our website — Easypay')}</LegalSubheading>
        <LegalBody>{p('thirdPartyPayments', 'Payments made on our website are handled by Easypay, the payment processor. The App itself does not take payments.')}</LegalBody>
        <LegalBody style={styles.after}>{p('thirdPartyNone', 'The App does not include any advertising SDKs or analytics trackers. We do not share your data with any third party for marketing or commercial purposes.')}</LegalBody>
      </LegalSection>

      <LegalSection title={p('section4Title', '4. Data Retention')}>
        <LegalBody>{p('retention', 'We retain your account data for as long as your account is active. Listening progress and bookmarks are kept for the lifetime of your account to preserve your practice history.\n\nLocally cached audio and transcripts can be removed at any time from the Settings screen.')}</LegalBody>
        <LegalSubheading>{p('retentionKeptTitle', 'What is kept after deletion')}</LegalSubheading>
        <LegalBody>{p('retentionKept', 'Records of past payments are kept, without your contact details, for as long as Portuguese accounting law requires. Any recurring payment is stopped.')}</LegalBody>
      </LegalSection>

      <LegalSection title={p('section5Title', '5. Your Rights')}>
        <LegalBody>{p('rights', 'Under the General Data Protection Regulation (GDPR), you have the right to:\n\n• Access — request a copy of all data we hold about you\n• Rectification — correct any inaccurate personal data\n• Erasure — delete your account and all associated personal data\n• Portability — receive your data in a structured, machine-readable format\n\nTo exercise any of these rights, contact us at the address below. We will respond within 30 days.')}</LegalBody>
        <LegalSubheading>{p('rightsDeleteTitle', 'Deleting your account')}</LegalSubheading>
        <LegalBody>{p('rightsDelete', 'You can delete your account yourself. In the app, go to Settings, then Delete account. If you do not have the app, you can do it from this page:')}</LegalBody>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={deletionUrl}
          onPress={() => router.push('/account-deletion' as any)}
          style={({ pressed }) => [styles.linkWrap, pressed && styles.linkPressed]}
        >
          <Text style={styles.link}>{deletionUrl}</Text>
        </Pressable>
      </LegalSection>

      <LegalSection title={p('section6Title', '6. Data Security')}>
        <LegalBody>{p('security', 'All communication between the App and our servers uses HTTPS encryption. Authentication tokens are stored securely on your device. We do not store passwords — access is managed through time-limited magic links.')}</LegalBody>
      </LegalSection>

      <LegalSection title={p('section7Title', "7. Children's Privacy")}>
        <LegalBody>{p('children', 'The App is not directed at children under the age of 16. We do not knowingly collect personal data from children.')}</LegalBody>
      </LegalSection>

      <LegalSection title={p('section8Title', '8. Changes to This Policy')}>
        <LegalBody>{p('changes', 'We may update this policy from time to time. Significant changes will be communicated through the App. The "last updated" date at the top reflects the most recent revision.')}</LegalBody>
      </LegalSection>

      <LegalSection title={p('section9Title', '9. Contact Us')}>
        <LegalBody>{p('contact', 'If you have questions about this privacy policy or wish to exercise your data rights, please contact:')}</LegalBody>
        <Text style={styles.contactInfo}>
          Associação Padmakara Portugal{'\n'}
          Email: padmakara.portugal@gmail.com
        </Text>
      </LegalSection>
    </LegalPage>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 14, color: c.gray[500] },
  intro: { marginTop: 20 },
  after: { marginTop: 18 },
  linkWrap: { alignSelf: 'flex-start', paddingVertical: 4 },
  linkPressed: { opacity: 0.7 },
  link: { ...pageStyles.link, textDecorationLine: 'underline' },
  contactInfo: { ...pageStyles.body, color: c.gray[800], fontWeight: '500', marginTop: 8 },
});
