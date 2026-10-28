import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { useFocusRing } from '@/components/membership/focusRing';
import { pageStyles } from '@/components/membership/pageStyles';
import { membershipColors as c } from '@/components/membership/theme';
import {
  isPasskeySupported,
  registerPasskey,
  removePasskey,
  tryListPasskeys,
  type PasskeySummary,
} from '@/services/passkeyService';
import { currentPasskeyWording } from '@/utils/passkeyWording';
import { formatLongDate } from '@/utils/dateFormat';
import { Rows, SettingsRow } from './ui';

function RemoveButton({
  label,
  text,
  onPress,
  testID,
}: {
  label: string;
  text: string;
  onPress: () => void;
  testID: string;
}) {
  const ring = useFocusRing();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      style={({ pressed }) => [styles.remove, pressed && pageStyles.rowPressed, ring.style]}
    >
      <Text style={styles.removeText}>{text}</Text>
    </Pressable>
  );
}

/** The member's saved passkeys: list, remove (with a confirmation) and add one on this device. */
export function PasskeySettings() {
  const { t, language } = useLanguage();
  const [keys, setKeys] = useState<PasskeySummary[] | null>(null);
  const [supported, setSupported] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<PasskeySummary | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);

  const tx = (key: string, fallback: string, vars?: Record<string, string>) => {
    const full = `settings.passkeys.${key}`;
    const v = t(full, vars);
    const text = v && v !== full ? v : fallback;
    return vars ? text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '') : text;
  };

  const refresh = useCallback(async () => {
    const next = await tryListPasskeys();
    if (mounted.current && next) setKeys(next);
    return next;
  }, []);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      const [isSupported] = await Promise.all([isPasskeySupported(), refresh()]);
      if (!mounted.current) return;
      setSupported(isSupported);
      setLoaded(true);
    })();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  if (!loaded) return null;
  // Nothing to manage and nothing to add: do not show a block that leads nowhere.
  if (!supported && (keys === null || keys.length === 0)) return null;

  const { method, apple } = currentPasskeyWording(Platform.OS, Platform.OS === 'ios' && Platform.isPad === true);
  const title = apple
    ? method === 'mac'
      ? tx('titleMac', 'Touch ID & passkeys')
      : tx('title', 'Face ID & passkeys')
    : tx('titleOther', 'Passkeys');
  const methodPhrase = {
    ios: tx('methodApple', 'Face ID or Touch ID'),
    mac: tx('methodMac', 'Touch ID'),
    android: tx('methodAndroid', 'your fingerprint or face'),
    desktop: tx('methodAny', 'your fingerprint, face or PIN'),
    generic: tx('methodAny', 'your fingerprint, face or PIN'),
  }[method];
  const explanation = tx('explanation', 'Sign in with {{method}} instead of waiting for an email.', {
    method: methodPhrase,
  });

  const confirmRemoval = async () => {
    const target = pendingRemoval;
    if (!target) return;
    setMessage(null);
    let removed = false;
    try {
      removed = await removePasskey(target.id);
    } catch {
      removed = false;
    }
    if (!mounted.current) return;
    if (removed) {
      // Drop it at once: a failed refresh must never leave a removed key on screen.
      setKeys((current) => (current ? current.filter((k) => k.id !== target.id) : current));
      await refresh();
    } else setMessage(tx('removeFailed', "That key couldn't be removed. Please try again."));
  };

  const add = async () => {
    if (adding) return;
    setAdding(true);
    setMessage(null);
    try {
      const result = await registerPasskey();
      if (!mounted.current) return;
      if (result.ok) await refresh();
      else if (!result.cancelled) setMessage(tx('addFailed', "That didn't work. You can try again."));
    } finally {
      if (mounted.current) setAdding(false);
    }
  };

  const describe = (k: PasskeySummary) => {
    const added = tx('added', 'Added {{date}}', { date: formatLongDate(k.createdAt, language) });
    const used = k.lastUsedAt
      ? tx('lastUsed', 'Last used {{date}}', { date: formatLongDate(k.lastUsedAt, language) })
      : tx('neverUsed', 'Never used');
    return `${added} · ${used}`;
  };

  return (
    <View testID="passkey-settings" style={styles.block}>
      <Text style={styles.heading} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.explanation}>{explanation}</Text>

      <Rows>
        {keys && keys.length === 0 ? (
          <SettingsRow testID="passkey-empty" title={tx('empty', 'No keys saved yet.')} />
        ) : null}
        {(keys ?? []).map((k) => (
          <SettingsRow
            key={k.id}
            testID={`passkey-row-${k.id}`}
            icon="key-outline"
            title={k.name}
            subtitle={describe(k)}
            right={
              <RemoveButton
                testID={`passkey-remove-${k.id}`}
                text={tx('remove', 'Remove')}
                label={tx('removeLabel', 'Remove, {{name}}', { name: k.name })}
                onPress={() => {
                  setMessage(null);
                  setPendingRemoval(k);
                }}
              />
            }
          />
        ))}
        {supported ? (
          <SettingsRow
            testID="passkey-add"
            icon="add-circle-outline"
            title={tx('add', 'Add a key on this device')}
            onPress={add}
            disabled={adding}
            right={adding ? <ActivityIndicator color={c.burgundy[500]} /> : undefined}
          />
        ) : null}
      </Rows>

      {message ? (
        <Text testID="passkey-message" style={styles.message} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}

      <ConfirmationModal
        visible={pendingRemoval !== null}
        title={tx('removeTitle', 'Remove this key?')}
        message={tx('removeMessage', '{{name}} will no longer sign you in. You can add a key again at any time.', {
          name: pendingRemoval?.name ?? '',
        })}
        icon="key-outline"
        onClose={() => setPendingRemoval(null)}
        buttons={[
          { text: t('common.cancel') || 'Cancel', style: 'cancel' },
          { text: tx('remove', 'Remove'), style: 'destructive', onPress: confirmRemoval },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 32 },
  heading: { ...(pageStyles.sectionLabel as object), marginTop: 0, marginBottom: 4 },
  explanation: { fontSize: 17, lineHeight: 24, color: c.gray[600], marginBottom: 12 },
  remove: { minHeight: 48, minWidth: 48, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  removeText: { fontSize: 17, fontWeight: '600', color: c.red[700] },
  message: { fontSize: 17, lineHeight: 24, color: c.gray[600], marginTop: 12 },
});
