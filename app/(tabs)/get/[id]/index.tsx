import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSignIn } from '@/components/auth/SignInProvider';
import { EasypayCheckout } from '@/components/membership/EasypayCheckout';
import { useFocusRing } from '@/components/membership/focusRing';
import { pageStyles, space } from '@/components/membership/pageStyles';
import { membershipColors as c } from '@/components/membership/theme';
import { refreshAccess } from '@/components/teachings/refreshAccess';
import { tt } from '@/components/teachings/tt';
import {
  teachingService,
  type Teaching,
  type TeachingCheckoutResult,
} from '@/services/teachingService';
import { formatDateRange } from '@/utils/dateFormat';
import { formatEuro } from '@/utils/membership';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Param = string | string[] | undefined;
const first = (v: Param) => (Array.isArray(v) ? v[0] : v);

export default function GetTeachingScreen() {
  // Buying is web-only (Apple and Google reader-app rules): native never shows a price or a buy button.
  if (Platform.OS !== 'web') return <Redirect href="/(tabs)" />;
  return <GetTeachingPage />;
}

type Load = { state: 'loading' } | { state: 'error' } | { state: 'missing' } | { state: 'ok'; teaching: Teaching };
type Phase =
  | { name: 'form' }
  | { name: 'paying'; orderId: string; manifest: { id: string; session: string }; testing: boolean }
  | { name: 'granted' }
  | { name: 'already' };

async function openRecordings(eventId: number, refreshUserData: () => Promise<void>) {
  await refreshAccess(refreshUserData);
  router.push(`/(tabs)/(groups)/retreat/${eventId}` as any);
}

function GetTeachingPage() {
  const { t, language } = useLanguage();
  const lang: 'en' | 'pt' = language === 'pt' ? 'pt' : 'en';
  const { isAuthenticated, hasActiveSubscription, user, refreshUserData } = useAuth();
  const { openSignIn } = useSignIn();
  const params = useLocalSearchParams<{ id?: Param }>();
  const id = first(params.id);
  const ring = useFocusRing();

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [phase, setPhase] = useState<Phase>({ name: 'form' });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [membersOnlyDenied, setMembersOnlyDenied] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoad({ state: 'missing' });
      return;
    }
    let cancelled = false;
    setLoad({ state: 'loading' });
    teachingService
      .get(id)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setLoad({ state: 'ok', teaching: res.data });
        else setLoad({ state: res.status === 404 ? 'missing' : 'error' });
      })
      .catch(() => !cancelled && setLoad({ state: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Signed in: the account's own name and email, the email locked.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const [f = '', ...rest] = (user.name ?? '').trim().split(/\s+/);
    setFirstName((v) => v || f);
    setLastName((v) => v || rest.join(' '));
    setEmail(user.email ?? '');
  }, [isAuthenticated, user]);

  const signIn = () => openSignIn({ returnTo: id ? `/get/${id}` : '/(tabs)' });

  if (load.state === 'loading') {
    return (
      <ScrollView style={styles.screen}>
        <ActivityIndicator style={{ marginTop: 48 }} color={c.burgundy[500]} />
      </ScrollView>
    );
  }
  if (load.state !== 'ok') {
    return (
      <ScrollView style={styles.screen}>
        <View style={styles.container}>
          <Text style={styles.message}>
            {load.state === 'missing'
              ? tt(t, 'notFound', 'These recordings are not available.')
              : tt(t, 'loadError', 'We could not load this page. Please try again.')}
          </Text>
        </View>
      </ScrollView>
    );
  }

  const teaching = load.teaching;
  const title = (lang === 'pt' ? teaching.titlePt || teaching.titleEn : teaching.titleEn || teaching.titlePt) ?? '';
  const meta = [
    teaching.startDate ? formatDateRange(teaching.startDate, teaching.endDate ?? undefined, lang) : '',
    teaching.teachers.map((x) => x.name).join(', '),
    teaching.places.map((x) => x.name).join(', '),
  ].filter(Boolean);
  const sessions =
    teaching.sessionCount === 1
      ? tt(t, 'sessionOne', '1 session')
      : tt(t, 'sessions', '{{count}} sessions', { count: teaching.sessionCount });
  const free = teaching.saleMode === 'free';
  const price = free ? tt(t, 'free', 'Free') : formatEuro((teaching.priceCents ?? 0) / 100, lang, { decimals: true });
  const isMember = isAuthenticated && hasActiveSubscription && teaching.includedInMembership;

  const submit = async () => {
    if (busy) return;
    if (!firstName.trim() || !lastName.trim()) return setError(tt(t, 'errName', 'Please enter your first and last name.'));
    if (!EMAIL_PATTERN.test(email.trim())) return setError(tt(t, 'errEmail', 'Please enter a valid email address.'));
    if (!consent) return setError(tt(t, 'errConsent', 'Please tick the box to continue.'));
    setBusy(true);
    setError(null);
    setDeclined(false);
    setMembersOnlyDenied(false);
    try {
      const res = await teachingService.checkout(String(teaching.id), {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        language: lang,
        consent: true,
      });
      if (res.success && res.data) {
        const out: TeachingCheckoutResult = res.data;
        if (out.status === 'granted') {
          setPhase({ name: 'granted' });
          if (isAuthenticated) void refreshAccess(refreshUserData);
        } else if (out.checkout.session === 'mock') {
          // API mock mode has no Easypay account: the order is already paid.
          router.replace(`/get/${teaching.id}/done?order=${encodeURIComponent(out.orderId)}` as any);
        } else {
          setPhase({ name: 'paying', orderId: out.orderId, manifest: out.checkout, testing: out.testing });
        }
      } else if (res.code === 'ALREADY_HAS_ACCESS') {
        setPhase({ name: 'already' });
      } else if (res.code === 'MEMBERS_ONLY') {
        setMembersOnlyDenied(true);
      } else if (res.code === 'PAYMENTS_UNAVAILABLE') {
        setError(tt(t, 'errUnavailable', 'Payments are temporarily unavailable. Please try again later.'));
      } else {
        setError(tt(t, 'errGeneric', 'Something went wrong. Please try again.'));
      }
    } catch {
      setError(tt(t, 'errGeneric', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const card = (
    <View>
      {teaching.imageUrl ? (
        <Image source={{ uri: teaching.imageUrl }} style={styles.image} accessibilityIgnoresInvertColors />
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {meta.map((line) => (
        <Text key={line} style={styles.meta}>
          {line}
        </Text>
      ))}
      <Text style={styles.meta}>{sessions}</Text>
      {!teaching.published && <Text style={styles.soon}>{tt(t, 'comingSoon', 'Recordings coming soon')}</Text>}
    </View>
  );

  const priceBlock = (
    <View>
      <View style={styles.order}>
        <Text style={styles.orderAmount} testID="teaching-price">
          {price}
        </Text>
      </View>
      {teaching.includedInMembership && (
        <Text style={styles.note}>{tt(t, 'included', 'Included for benefactor members.')}</Text>
      )}
      {teaching.membersOnly && (
        <Text style={styles.note}>{tt(t, 'membersOnly', 'For benefactor members only.')}</Text>
      )}
    </View>
  );

  if (phase.name === 'granted' || phase.name === 'already') {
    const granted = phase.name === 'granted';
    return (
      <ScrollView style={styles.screen}>
        <View style={styles.container}>
          {card}
          <Text style={styles.sectionLabel}>
            {granted
              ? tt(t, 'grantedTitle', 'The recordings are in your account')
              : tt(t, 'alreadyTitle', 'You already have these recordings')}
          </Text>
          <Text style={styles.body}>
            {granted
              ? tt(t, 'grantedBody', 'We have sent you an email with the details.')
              : isAuthenticated
                ? tt(t, 'alreadySignedIn', 'You can open them now.')
                : tt(t, 'alreadySignedOut', 'Sign in to open them.')}
          </Text>
          {isAuthenticated ? (
            teaching.published && (
              <ActionButton label={tt(t, 'open', 'Open the recordings')} onPress={() => openRecordings(teaching.id, refreshUserData)} />
            )
          ) : (
            <ActionButton label={tt(t, 'signIn', 'Sign in')} onPress={signIn} />
          )}
        </View>
      </ScrollView>
    );
  }

  if (phase.name === 'paying') {
    return (
      <ScrollView style={styles.screen}>
        <View style={styles.container}>
          {card}
          {priceBlock}
          {declined && (
            <Text style={styles.error} accessibilityRole="alert">
              {tt(t, 'errDeclined', 'Your payment was declined. Nothing was charged.')}
            </Text>
          )}
          <EasypayCheckout
            manifest={phase.manifest}
            testing={phase.testing}
            language={lang}
            onSuccess={() => router.replace(`/get/${teaching.id}/done?order=${encodeURIComponent(phase.orderId)}` as any)}
            onClose={() => setPhase({ name: 'form' })}
            onPaymentError={() => setDeclined(true)}
            onFatal={() => {
              setError(tt(t, 'payFatal', 'The payment form could not be loaded. Please try again.'));
              setPhase({ name: 'form' });
            }}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        {card}
        {priceBlock}

        {isMember ? (
          <View style={{ marginTop: space.block, gap: 14 }}>
            <Text style={styles.sectionLabel}>{tt(t, 'includedYours', 'Included in your membership')}</Text>
            {teaching.published && (
              <ActionButton label={tt(t, 'open', 'Open the recordings')} onPress={() => openRecordings(teaching.id, refreshUserData)} />
            )}
          </View>
        ) : (
          <View style={{ marginTop: space.block }}>
            <Field label={tt(t, 'firstName', 'First name')}>
              <TextInput
                style={[styles.input, ring.style]}
                value={firstName}
                onChangeText={setFirstName}
                autoComplete="given-name"
                editable={!busy}
                accessibilityLabel={tt(t, 'firstName', 'First name')}
                onFocus={ring.onFocus}
                onBlur={ring.onBlur}
              />
            </Field>
            <Field label={tt(t, 'lastName', 'Last name')}>
              <TextInput
                style={[styles.input, ring.style]}
                value={lastName}
                onChangeText={setLastName}
                autoComplete="family-name"
                editable={!busy}
                accessibilityLabel={tt(t, 'lastName', 'Last name')}
                onFocus={ring.onFocus}
                onBlur={ring.onBlur}
              />
            </Field>
            <Field label={tt(t, 'email', 'Email')}>
              <TextInput
                style={[styles.input, ring.style, isAuthenticated && styles.locked]}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                editable={!busy && !isAuthenticated}
                accessibilityLabel={tt(t, 'email', 'Email')}
                onFocus={ring.onFocus}
                onBlur={ring.onBlur}
              />
            </Field>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              style={styles.consentRow}
              onPress={() => setConsent((v) => !v)}
            >
              <View style={[styles.box, consent && styles.boxOn]}>
                {consent && <Text style={styles.tick}>{'✓'}</Text>}
              </View>
              <Text style={styles.consentText}>
                {tt(
                  t,
                  'consent',
                  'I agree that Associação Padmakara processes my data to give me access to these recordings.',
                )}
              </Text>
            </Pressable>

            <Text style={styles.note}>{tt(t, 'hardship', "Can't afford it? Write to info@padmakara.pt")}</Text>

            {error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}
            {membersOnlyDenied && (
              <View>
                <Text style={styles.error} accessibilityRole="alert">
                  {tt(
                    t,
                    'membersOnlyDenied',
                    'This teaching is for benefactor members. Sign in with the email of your membership, or become a member first.',
                  )}
                </Text>
                <Text
                  style={styles.link}
                  accessibilityRole="link"
                  onPress={() => router.push('/membership' as any)}
                >
                  {tt(t, 'becomeMember', 'Become a benefactor member')}
                </Text>
              </View>
            )}
            <ActionButton
              label={free ? tt(t, 'getFree', 'Get the recordings') : tt(t, 'pay', 'Continue to payment')}
              onPress={submit}
              busy={busy}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ActionButton({ label, onPress, busy = false }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      style={({ pressed }) => [styles.button, pressed && pageStyles.buttonPressed, busy && styles.busy]}
      onPress={onPress}
    >
      <Text style={pageStyles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream[100] },
  container: pageStyles.container,
  image: { width: '100%', height: 200, marginTop: 24, backgroundColor: c.gray[200] },
  title: pageStyles.title,
  meta: { fontSize: 15, lineHeight: 22, color: c.gray[600], marginTop: 4 },
  soon: { fontSize: 15, color: c.amber[700], marginTop: 10 },
  order: {
    marginTop: space.block,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.gray[200],
  },
  orderAmount: { fontSize: 22, fontFamily: 'EBGaramond_600SemiBold', color: c.gray[800] },
  note: { fontSize: 14, lineHeight: 21, color: c.gray[600], marginTop: 10 },
  sectionLabel: { ...pageStyles.sectionLabel },
  body: { ...pageStyles.body, marginBottom: 20 },
  message: { ...pageStyles.body, marginTop: 24 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: c.gray[700], marginBottom: 6 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: c.gray[300],
    backgroundColor: c.white,
    paddingHorizontal: 14,
    fontSize: 17,
    color: c.gray[800],
  },
  locked: { backgroundColor: c.gray[100], color: c.gray[600] },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, gap: 12 },
  box: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: c.gray[400],
    backgroundColor: c.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: c.burgundy[500], borderColor: c.burgundy[500] },
  tick: { color: 'white', fontSize: 14, fontWeight: '700' },
  consentText: { flex: 1, fontSize: 15, lineHeight: 22, color: c.gray[700] },
  error: { fontSize: 14, color: c.red[700], marginTop: 12 },
  link: { fontSize: 15, color: c.burgundy[500], textDecorationLine: 'underline', marginTop: 8 },
  button: { ...pageStyles.button, marginTop: 24, minWidth: 200, alignItems: 'center' },
  busy: { opacity: 0.7 },
});
