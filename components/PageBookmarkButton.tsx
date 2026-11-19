import React from 'react';
import { StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

interface PageBookmarkButtonProps {
  /** Whether the page on screen is bookmarked: the icon is filled then. */
  bookmarked: boolean;
  onToggle: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** The reader header's bookmark for the page on screen: a tap adds it, a second tap removes it. */
export function PageBookmarkButton({ bookmarked, onToggle, style, testID }: PageBookmarkButtonProps) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onToggle}
      hitSlop={8}
      style={style}
      accessibilityRole="button"
      accessibilityState={{ selected: bookmarked }}
      accessibilityLabel={
        bookmarked
          ? t('pdfViewer.removePageBookmark') || 'Remove the bookmark on this page'
          : t('pdfViewer.bookmarkPage') || 'Bookmark this page'
      }
    >
      <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color={colors.burgundy[500]} />
    </TouchableOpacity>
  );
}
