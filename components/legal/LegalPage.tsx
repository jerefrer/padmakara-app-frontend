import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '@/components/ui/BackButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { pageStyles } from '@/components/membership/pageStyles';
import { membershipColors as c } from '@/components/membership/theme';
import { GroupLabel, SectionTitle } from '@/components/settings/ui';

/**
 * Shared frame of the two public legal pages (privacy policy, account deletion): the page
 * background and back row of the membership pages, a left-aligned title, and the same
 * section hierarchy as Settings (uppercase label, then body text).
 */
interface Props {
  title: string;
  /** Shown at the right of the back row (the language switch). */
  headerRight?: React.ReactNode;
  backDisabled?: boolean;
  children: React.ReactNode;
}

export function LegalPage({ title, headerRight, backDisabled, children }: Props) {
  const { t } = useLanguage();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <BackButton variant="inline" label={t('navigation.back') || 'Back'} disabled={backDisabled} />
        {headerRight}
      </View>
      <View style={styles.container}>
        <SectionTitle>{title}</SectionTitle>
        {children}
      </View>
    </ScrollView>
  );
}

/** An uppercase section label followed by its body. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <GroupLabel>{title}</GroupLabel>
      {children}
    </View>
  );
}

/** A quieter heading inside a section, at the weight of a settings row title. */
export function LegalSubheading({ children }: { children: string }) {
  return (
    <Text style={styles.subheading} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function LegalBody({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[pageStyles.body, styles.body, style]}>{children}</Text>;
}

export const legalStyles = StyleSheet.create({
  fieldLabel: { fontSize: 13, fontWeight: '600', color: c.gray[700], marginTop: 24, marginBottom: 6 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream[100] },
  scroll: { paddingBottom: 60 },
  header: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  container: pageStyles.container,
  subheading: { fontSize: 16, fontWeight: '600', color: c.gray[800], marginTop: 18, marginBottom: 4 },
  body: { marginBottom: 4 },
});
