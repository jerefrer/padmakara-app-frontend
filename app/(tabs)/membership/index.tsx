import React from 'react';
import { ScrollView, StyleSheet, Platform } from 'react-native';
import { BackButton } from '@/components/ui/BackButton';
import { ReaderAccountStatus } from '@/components/membership/ReaderAccountStatus';
import { WebMembershipBody } from '@/components/membership/WebMembershipBody';
import { membershipColors as c } from '@/components/membership/theme';

export default function MembershipScreen() {
  if (Platform.OS !== 'web') return <ReaderAccountStatus />;
  return (
    <ScrollView style={styles.screen}>
      <BackButton />
      <WebMembershipBody />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream[100] },
});
