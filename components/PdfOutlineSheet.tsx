import React from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PdfOutlineItem } from '@/utils/pdfOutline';

interface PdfOutlineSheetProps {
  visible: boolean;
  items: PdfOutlineItem[];
  currentPage: number;
  onSelect: (page: number) => void;
  onClose: () => void;
}

/** The entry the reader is in: the last one starting at or before the current page. */
function currentIndex(items: PdfOutlineItem[], page: number): number {
  let index = -1;
  items.forEach((item, i) => {
    if (item.page <= page) index = i;
  });
  return index;
}

/** A document's table of contents; tapping an entry jumps to its page. */
export function PdfOutlineSheet({ visible, items, currentPage, onSelect, onClose }: PdfOutlineSheetProps) {
  const { t } = useLanguage();
  const active = currentIndex(items, currentPage);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('pdfViewer.contents') || 'Contents'}</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('pdfViewer.closeContents') || 'Close the table of contents'}
          >
            <Ionicons name="close" size={24} color={colors.gray[700]} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={(item, index) => `${index}-${item.page}`}
          initialScrollIndex={active > 3 ? active - 3 : undefined}
          getItemLayout={(_data, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          renderItem={({ item, index }) => {
            const selected = index === active;
            return (
              <TouchableOpacity
                testID={`outline-item-${index}`}
                style={[styles.row, { paddingLeft: 20 + item.depth * 16 }, selected && styles.rowSelected]}
                onPress={() => {
                  onSelect(item.page);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[styles.rowTitle, item.depth === 0 && styles.rowTitleTop, selected && styles.rowTitleSelected]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <Text style={styles.rowPage}>
                  {t('pdfViewer.pageNumber', { page: String(item.page) }) || `p. ${item.page}`}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const ROW_HEIGHT = 56;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  rowSelected: {
    backgroundColor: colors.cream[100],
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    color: colors.gray[700],
  },
  rowTitleTop: {
    fontWeight: '600',
  },
  rowTitleSelected: {
    color: colors.burgundy[500],
  },
  rowPage: {
    marginLeft: 12,
    fontSize: 13,
    color: colors.gray[500],
  },
});
