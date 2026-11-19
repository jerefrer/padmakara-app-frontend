import React, { useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PdfOutlineItem } from '@/utils/pdfOutline';
import { chapterOfPage } from '@/utils/readerState';

interface PdfOutlineSheetProps {
  visible: boolean;
  items: PdfOutlineItem[];
  currentPage: number;
  onSelect: (page: number) => void;
  onClose: () => void;
  /** Bookmarked pages, listed above the table of contents. */
  bookmarks?: number[];
  onRemoveBookmark?: (page: number) => void;
}

/** The entry the reader is in: the last one starting at or before the current page. */
function currentIndex(items: PdfOutlineItem[], page: number): number {
  let index = -1;
  items.forEach((item, i) => {
    if (item.page <= page) index = i;
  });
  return index;
}

type Row =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'bookmark'; key: string; page: number; chapter: string | null }
  | { kind: 'outline'; key: string; item: PdfOutlineItem; index: number };

const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 36;

const rowHeight = (row: Row) => (row.kind === 'header' ? HEADER_HEIGHT : ROW_HEIGHT);

/**
 * A document's bookmarked pages and table of contents; tapping an entry jumps
 * to its page. Bookmarks come first, each with the chapter it falls in.
 * The sheet is only as tall as its entries (capped, then it scrolls), so a short
 * list does not hide the whole page behind an empty sheet.
 */
export function PdfOutlineSheet({
  visible,
  items,
  currentPage,
  onSelect,
  onClose,
  bookmarks = [],
  onRemoveBookmark,
}: PdfOutlineSheetProps) {
  const { t } = useLanguage();
  const active = currentIndex(items, currentPage);
  const insets = useSafeAreaInsets();

  const bookmarksTitle = t('pdfViewer.bookmarkedPages') || 'Bookmarked pages';
  const contentsTitle = t('pdfViewer.contents') || 'Contents';
  const both = bookmarks.length > 0 && items.length > 0;

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    if (both) list.push({ kind: 'header', key: 'h-bookmarks', title: bookmarksTitle });
    for (const page of bookmarks) list.push({ kind: 'bookmark', key: `b-${page}`, page, chapter: chapterOfPage(items, page) });
    if (both) list.push({ kind: 'header', key: 'h-contents', title: contentsTitle });
    items.forEach((item, index) => list.push({ kind: 'outline', key: `o-${index}-${item.page}`, item, index }));
    return list;
  }, [bookmarks, items, both, bookmarksTitle, contentsTitle]);

  const offsets = useMemo(() => {
    const result: number[] = [];
    let offset = 0;
    for (const row of rows) {
      result.push(offset);
      offset += rowHeight(row);
    }
    return result;
  }, [rows]);

  // Without bookmarks the list opens on the reader's section; with them it
  // opens at the top, so the bookmarked pages are in view.
  const activeRow = bookmarks.length > 0 ? -1 : rows.findIndex((row) => row.kind === 'outline' && row.index === active);

  const pageLabel = (page: number) => t('pdfViewer.page', { page: String(page) }) || `Page ${page}`;

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
            <Text style={styles.title} accessibilityRole="header">
              {items.length > 0 ? contentsTitle : bookmarksTitle}
            </Text>
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
            data={rows}
            keyExtractor={(row) => row.key}
            initialScrollIndex={activeRow > 3 ? activeRow - 3 : undefined}
            getItemLayout={(_data, index) => ({
              length: rows[index] ? rowHeight(rows[index]) : ROW_HEIGHT,
              offset: offsets[index] ?? 0,
              index,
            })}
            renderItem={({ item: row }) => {
              if (row.kind === 'header') {
                return (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText} accessibilityRole="header">
                      {row.title}
                    </Text>
                  </View>
                );
              }
              if (row.kind === 'bookmark') {
                return (
                  <View style={styles.row} testID={`page-bookmark-${row.page}`}>
                    <TouchableOpacity
                      testID={`page-bookmark-open-${row.page}`}
                      style={styles.bookmarkOpen}
                      onPress={() => {
                        onSelect(row.page);
                        onClose();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={[pageLabel(row.page), row.chapter].filter(Boolean).join(', ')}
                    >
                      <Ionicons name="bookmark" size={18} color={colors.burgundy[500]} style={styles.bookmarkIcon} />
                      <View style={styles.bookmarkText}>
                        <Text style={styles.bookmarkTitle} numberOfLines={1}>
                          {pageLabel(row.page)}
                        </Text>
                        {row.chapter ? (
                          <Text style={styles.bookmarkChapter} numberOfLines={1}>
                            {row.chapter}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                    {onRemoveBookmark ? (
                      <TouchableOpacity
                        testID={`page-bookmark-remove-${row.page}`}
                        onPress={() => onRemoveBookmark(row.page)}
                        hitSlop={8}
                        style={styles.removeButton}
                        accessibilityRole="button"
                        accessibilityLabel={
                          t('pdfViewer.removeBookmarkOnPage', { page: String(row.page) }) ||
                          `Remove the bookmark on page ${row.page}`
                        }
                      >
                        <Ionicons name="close-circle-outline" size={22} color={colors.gray[500]} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              }
              const { item, index } = row;
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '80%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
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
  sectionHeader: {
    height: HEADER_HEIGHT,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 6,
    backgroundColor: colors.cream[100],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
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
  bookmarkOpen: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookmarkIcon: {
    marginRight: 12,
  },
  bookmarkText: {
    flex: 1,
  },
  bookmarkTitle: {
    fontSize: 15,
    color: colors.gray[700],
  },
  bookmarkChapter: {
    marginTop: 2,
    fontSize: 13,
    color: colors.gray[500],
  },
  removeButton: {
    marginLeft: 12,
    padding: 4,
  },
});
