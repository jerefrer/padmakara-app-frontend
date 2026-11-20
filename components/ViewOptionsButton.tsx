import React from 'react';
import { Platform, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

interface ViewOptionsButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The web reader's "viewing options" button for a screen's top bar: it opens
 * the viewer's popover (layout, fit, zoom, reading theme, full screen).
 * Renders nothing on the phones, whose theme button and pinch zoom cover it.
 */
export function ViewOptionsButton({ onPress, style, testID }: ViewOptionsButtonProps) {
  const { t } = useLanguage();
  if (Platform.OS !== 'web') return null;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      hitSlop={8}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={t('pdfViewer.viewOptions') || 'View options'}
    >
      <Ionicons name="options-outline" size={24} color={colors.burgundy[500]} />
    </TouchableOpacity>
  );
}
