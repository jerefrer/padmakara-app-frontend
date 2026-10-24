import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

interface DocumentShareButtonProps {
  /** Local file path of the PDF exactly as the reader is viewing it. */
  filePath: string;
  /** Display name used to build the shared filename. */
  filename: string;
  /** Called when the file could not be shared. */
  onError: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Makes a name safe for the file system and guarantees a .pdf extension. */
export function sanitizePdfFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  const base = cleaned.replace(/\.pdf$/i, '').trim() || 'document';
  return `${base}.pdf`;
}

/**
 * Returns a path to share: the viewed file itself when its name is already
 * proper, otherwise a copy in the cache dir under the sanitized name.
 */
async function resolveSharePath(filePath: string, filename: string): Promise<string> {
  const wanted = sanitizePdfFilename(filename);
  const current = decodeURIComponent(filePath.split('/').pop() || '');
  if (current === wanted) return filePath;
  const dir = `${FileSystem.cacheDirectory}event-files/share/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const target = `${dir}${wanted}`;
  await FileSystem.deleteAsync(target, { idempotent: true });
  await FileSystem.copyAsync({ from: filePath, to: target });
  return target;
}

/**
 * Share/export button for the in-app PDF viewer. Shares the very file being
 * viewed (so a watermarked copy of a sensitive file stays watermarked) through
 * the system share sheet. Renders nothing on web or when sharing is unavailable.
 */
export function DocumentShareButton({ filePath, filename, onError, style }: DocumentShareButtonProps) {
  const { t } = useLanguage();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    Sharing.isAvailableAsync()
      .then((ok) => {
        if (!cancelled) setAvailable(ok);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (Platform.OS === 'web' || !available) return null;

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const path = await resolveSharePath(filePath, filename);
      await Sharing.shareAsync(path, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch (err) {
      console.error('Document share error:', err);
      onError();
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={t('documents.share') || 'Share or save this text'}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={style}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.burgundy[500]} />
      ) : (
        <Ionicons name="share-outline" size={22} color={colors.burgundy[500]} />
      )}
    </TouchableOpacity>
  );
}
