/**
 * TranscriptTags - small neutral tags next to a transcript's language in the
 * documents list: "Provisional", "Unrevised", "Draft" and/or "Excerpts".
 * A final, full transcript shows nothing.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { transcriptTags, type TranscriptTag } from '@/utils/transcriptMeta';

const TAG_KEYS: Record<TranscriptTag, { key: string; fallback: string }> = {
  provisional: { key: 'documents.transcriptStatus.provisional', fallback: 'Provisional' },
  unrevised: { key: 'documents.transcriptStatus.unrevised', fallback: 'Unrevised' },
  draft: { key: 'documents.transcriptStatus.draft', fallback: 'Draft' },
  excerpts: { key: 'documents.transcriptExcerpts', fallback: 'Excerpts' },
};

interface TranscriptTagsProps {
  status?: string;
  isExcerpt?: boolean;
}

export function TranscriptTags({ status, isExcerpt }: TranscriptTagsProps) {
  const { t } = useLanguage();
  const tags = transcriptTags({ status, isExcerpt });
  if (tags.length === 0) return null;
  return (
    <>
      {tags.map((tag) => (
        <View key={tag} style={styles.tag}>
          <Text style={styles.tagText}>{t(TAG_KEYS[tag].key) || TAG_KEYS[tag].fallback}</Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: colors.gray[100],
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    flexShrink: 0,
  },
  tagText: {
    fontSize: 11,
    color: colors.gray[600],
  },
});

export default TranscriptTags;
