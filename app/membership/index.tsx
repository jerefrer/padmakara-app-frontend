import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipService, type MembershipView } from '@/services/membershipService';
import { ManageMembership } from '@/components/membership/ManageMembership';
import { JoinMembership } from '@/components/membership/JoinMembership';
import { ReaderAccountStatus } from '@/components/membership/ReaderAccountStatus';
import { membershipColors as c } from '@/components/membership/theme';
import { tr } from '@/components/membership/tr';

export default function MembershipScreen() {
  if (Platform.OS !== 'web') return <ReaderAccountStatus />;
  return <WebMembership />;
}

function WebMembership() {
  const { t } = useLanguage();
  const { isAuthenticated, isLoading } = useAuth();
  const [view, setView] = useState<MembershipView | null>(null);
  const [failed, setFailed] = useState(false);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    membershipService
      .get()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setView(res.data);
          setFailed(false);
        } else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, reload]);

  let body: React.ReactNode;
  if (isLoading || (isAuthenticated && !view && !failed)) {
    body = <ActivityIndicator style={styles.center} color={c.burgundy[500]} />;
  } else if (failed) {
    body = <Text style={styles.placeholder}>{tr(t, 'errGeneric', 'Something went wrong. Please try again.')}</Text>;
  } else if (!isAuthenticated || view?.state === 'none' || view?.state === 'lapsed') {
    body = <JoinMembership />;
  } else {
    body = <ManageMembership membership={view!} onChanged={() => setReload((n) => n + 1)} />;
  }

  return <ScrollView style={styles.screen}>{body}</ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream[100] },
  center: { marginTop: 48 },
  placeholder: { padding: 24, fontSize: 18, color: c.gray[700] },
});
