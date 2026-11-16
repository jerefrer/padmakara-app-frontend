import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

/**
 * A document's table of contents; tapping an entry jumps to its page.
 * The sheet is only as tall as its entries (capped, then it scrolls), so a short
 * outline does not hide the whole page behind an empty sheet.
 */
export function PdfOutlineSheet({ visible, items, currentPage, onSelect, onClose }: PdfOutlineSheetProps) {
  const { t } = useLanguage();
  const active = currentIndex(items, currentPage);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.overlay}>
        {/* The close button is the accessible way out; the backdrop is a tap target only. */}
        <Pressable
          testID="outline-backdrop"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        {/* Insets from the app's provider: SafeAreaView inside a transparent Modal
            measures zero on iOS and let the last entry sit on the home indicator. */}
        <View
          testID="outline-sheet"
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
          ]}
        >
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
            style={styles.list}
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
        </View>
      </View>
    </Modal>
  );
}

const ROW_HEIGHT = 56;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  // Takes its rows' height, and shrinks to scroll once the sheet hits its cap.
  list: {
    flexGrow: 0,
    flexShrink: 1,
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
