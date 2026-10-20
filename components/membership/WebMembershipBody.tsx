import React, { useEffect, useState } from 'react';
import { Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { membershipService, type MembershipView } from '@/services/membershipService';
import { ManageMembership } from './ManageMembership';
import { ProcessingNotice } from './ProcessingNotice';
import { JoinMembership } from './JoinMembership';
import { membershipColors as c } from './theme';
import { tr } from './tr';

/**
 * Web only: the membership as the person stands today — join, a payment being processed, or
 * manage. Shared by the /membership page and the Membership pane of the desktop Settings.
 */
export function WebMembershipBody() {
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

  if (isLoading || (isAuthenticated && !view && !failed)) {
    return <ActivityIndicator style={styles.center} color={c.burgundy[500]} />;
  }
  if (failed) {
    return <Text style={styles.placeholder}>{tr(t, 'errGeneric', 'Something went wrong. Please try again.')}</Text>;
  }
  if (isAuthenticated && view?.state === 'processing') {
    return <ProcessingNotice showBack={false} onBack={() => router.replace('/(tabs)' as any)} />;
  }
  if (!isAuthenticated || view?.state === 'none' || view?.state === 'lapsed') {
    return <JoinMembership lastPaymentFailedAt={view?.state === 'none' ? view.lastPaymentFailedAt : null} />;
  }
  return <ManageMembership membership={view!} onChanged={() => setReload((n) => n + 1)} />;
}

const styles = StyleSheet.create({
  center: { marginTop: 48 },
  placeholder: { padding: 24, fontSize: 18, color: c.gray[700] },
});
