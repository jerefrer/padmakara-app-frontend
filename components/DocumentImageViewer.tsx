import React from 'react';
import { Modal, View, Image, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

interface DocumentImageViewerProps {
  visible: boolean;
  /** Local or remote URI to display, as returned by retreatService.getFileUrl(). */
  uri: string | null;
  title?: string;
  onClose: () => void;
}

/**
 * Full-screen modal image viewer for event documents whose `viewer` is
 * 'image' (e.g. a scanned page, a photo, a diagram attached to an event).
 * Used by the Documents tab in the retreat detail screen — fed by
 * retreatService.getFileUrl().
 */
export function DocumentImageViewer({ visible, uri, title, onClose }: DocumentImageViewerProps) {
  const { t } = useLanguage();

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title || t('documents.image') || 'Image'}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('documents.close') || 'Close'}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={colors.gray[700]} />
          </TouchableOpacity>
        </View>
        {uri && (
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[700],
    marginRight: 12,
  },
  closeButton: {
    padding: 4,
  },
  image: {
    flex: 1,
    backgroundColor: colors.gray[100],
  },
});

export default DocumentImageViewer;
