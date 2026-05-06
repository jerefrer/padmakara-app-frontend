import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { publicationService } from '@/services/publicationService';
import { PDFViewer } from '@/components/PDFViewer';
import { colors } from '@/constants/colors';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import type { Publication } from '@/types';

type SortMode = 'title' | 'author' | 'latest';

export default function PublicationsScreen() {
  const { t } = useLanguage();
  const { hasActiveSubscription } = useAuth();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useDesktopLayout();

  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);

  // PDF viewer state
  const [viewingPdf, setViewingPdf] = useState<{
    uri: string;
    publication: Publication;
    cachedVersion: string | null;
  } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updatingVersion, setUpdatingVersion] = useState(false);
  const [versionBannerDismissed, setVersionBannerDismissed] = useState<
    Record<string, boolean>
  >({});

  // Load publications
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    publicationService
      .getPublications()
      .then((data) => {
        if (!cancelled) setPublications(data);
      })
      .catch((err) => {
        console.error('Failed to load publications:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Derive available languages from publications
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    for (const pub of publications) {
      if (pub.language) langs.add(pub.language.toUpperCase());
    }
    return Array.from(langs).sort();
  }, [publications]);

  // Filter and sort publications
  const filteredPublications = useMemo(() => {
    let list = [...publications];

    // Language filter
    if (languageFilter) {
      list = list.filter(
        (p) => p.language?.toUpperCase() === languageFilter
      );
    }

    // Sort
    switch (sortMode) {
      case 'title': {
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      }
      case 'author': {
        list.sort((a, b) => {
          const authorA = a.authors?.[0] || '';
          const authorB = b.authors?.[0] || '';
          return authorA.localeCompare(authorB);
        });
        break;
      }
      case 'latest': {
        list.sort((a, b) => {
          const dateA = a.publicationDate || a.updatedAt || '';
          const dateB = b.publicationDate || b.updatedAt || '';
          return dateB.localeCompare(dateA);
        });
        break;
      }
    }

    return list;
  }, [publications, sortMode, languageFilter]);

  // Sections grouped by author (for author sort mode)
  const authorSections = useMemo(() => {
    if (sortMode !== 'author') return [];

    const groups = new Map<string, Publication[]>();
    for (const pub of filteredPublications) {
      const author = pub.authors?.[0] || t('publications.authors') || 'Unknown';
      const existing = groups.get(author);
      if (existing) {
        existing.push(pub);
      } else {
        groups.set(author, [pub]);
      }
    }

    return Array.from(groups.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, [filteredPublications, sortMode, t]);

  // Check if there are hidden publications (subscriber-only ones user can't see)
  const hasHiddenPublications = useMemo(() => {
    return publications.some(
      (p) => p.accessLevel === 'subscribers' && !hasActiveSubscription
    );
  }, [publications, hasActiveSubscription]);

  // Open a publication PDF
  const handleOpenPublication = useCallback(
    async (publication: Publication) => {
      try {
        setDownloading(publication.id);
        setDownloadProgress(0);

        // Check cache first — return cached PDF even if a newer server version
        // exists. The user is offered an in-reader banner to update.
        const cached = await publicationService.getCachedPdf(publication.id);

        let pdfUri: string;
        let cachedVersion: string | null;
        if (cached) {
          pdfUri = cached;
          cachedVersion = await publicationService.getCachedVersion(
            publication.id
          );
        } else {
          pdfUri = await publicationService.downloadAndCachePdf(
            publication.id,
            publication.updatedAt,
            publication.version,
            (progress) => setDownloadProgress(progress)
          );
          cachedVersion = publication.version;
        }

        setDownloading(null);
        setViewingPdf({ uri: pdfUri, publication, cachedVersion });

        // Restore reading position
        const savedPage = await publicationService.getReadingPosition(
          publication.id
        );
        if (savedPage) {
          // PDFViewer doesn't support initialPage yet, but position is saved
          // for future enhancement
        }
      } catch (err) {
        console.error('Failed to open publication:', err);
        setDownloading(null);
        // Could show alert here
      }
    },
    []
  );

  // Replace cached PDF with the latest server version (user-triggered).
  const handleUpdateVersion = useCallback(async () => {
    if (!viewingPdf) return;
    const { publication } = viewingPdf;
    try {
      setUpdatingVersion(true);
      setDownloadProgress(0);
      const newUri = await publicationService.downloadAndCachePdf(
        publication.id,
        publication.updatedAt,
        publication.version,
        (progress) => setDownloadProgress(progress)
      );
      setViewingPdf({
        uri: newUri,
        publication,
        cachedVersion: publication.version,
      });
    } catch (err) {
      console.error('Failed to update publication:', err);
    } finally {
      setUpdatingVersion(false);
      setDownloadProgress(0);
    }
  }, [viewingPdf]);

  // Get display title for a publication
  const getTitle = useCallback(
    (pub: Publication) => pub.title,
    []
  );

  // Render a publication item
  const renderPublicationItem = useCallback(
    ({ item }: { item: Publication }) => {
      const title = getTitle(item);
      const authorLine = item.authors?.join(', ') || '';
      const isDownloading = downloading === item.id;

      return (
        <TouchableOpacity
          style={styles.publicationItem}
          onPress={() => handleOpenPublication(item)}
          disabled={isDownloading}
          activeOpacity={0.7}
        >
          {/* Cover thumbnail */}
          <View style={styles.coverContainer}>
            {item.coverImageUrl ? (
              <Image
                source={{ uri: item.coverImageUrl }}
                style={styles.coverImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons
                  name="book-outline"
                  size={24}
                  color={colors.gray[400]}
                />
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.publicationInfo}>
            <Text style={styles.publicationTitle} numberOfLines={2}>
              {title}
            </Text>
            {authorLine ? (
              <Text style={styles.publicationSubtitle} numberOfLines={1}>
                {authorLine}
              </Text>
            ) : null}
          </View>

          {/* Download indicator */}
          {isDownloading ? (
            <View style={styles.downloadIndicator}>
              <ActivityIndicator size="small" color={colors.burgundy[500]} />
              <Text style={styles.downloadText}>
                {Math.round(downloadProgress * 100)}%
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      );
    },
    [getTitle, downloading, downloadProgress, handleOpenPublication, t]
  );

  // If viewing a PDF, show full-screen viewer
  if (viewingPdf) {
    const serverVersion = viewingPdf.publication.version;
    const cachedVersion = viewingPdf.cachedVersion;
    const showUpdateBanner =
      !!serverVersion &&
      serverVersion !== cachedVersion &&
      !versionBannerDismissed[viewingPdf.publication.id];

    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* PDF header */}
          <View style={styles.pdfHeader}>
            <TouchableOpacity
              style={styles.pdfBackButton}
              onPress={() => setViewingPdf(null)}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.burgundy[500]}
              />
            </TouchableOpacity>
            <Text style={styles.pdfHeaderTitle} numberOfLines={1}>
              {getTitle(viewingPdf.publication)}
            </Text>
          </View>

          {/* New-version banner */}
          {showUpdateBanner && (
            <View style={styles.versionBanner}>
              <Ionicons
                name="cloud-download-outline"
                size={18}
                color={colors.burgundy[500]}
              />
              <View style={styles.versionBannerText}>
                <Text style={styles.versionBannerTitle}>
                  {t('publications.newVersion.available') ||
                    'New version available'}
                </Text>
                {serverVersion ? (
                  <Text style={styles.versionBannerSubtitle}>
                    {(t('publications.newVersion.label') || 'Version {version}').replace(
                      '{version}',
                      serverVersion,
                    )}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.versionUpdateButton}
                onPress={handleUpdateVersion}
                disabled={updatingVersion}
              >
                {updatingVersion ? (
                  <View style={styles.versionUpdateContent}>
                    <ActivityIndicator size="small" color={colors.white} />
                    <Text style={styles.versionUpdateText}>
                      {downloadProgress > 0
                        ? `${Math.round(downloadProgress * 100)}%`
                        : t('publications.newVersion.updating') || 'Updating...'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.versionUpdateText}>
                    {t('publications.newVersion.update') || 'Update'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.versionDismissButton}
                onPress={() =>
                  setVersionBannerDismissed((prev) => ({
                    ...prev,
                    [viewingPdf.publication.id]: true,
                  }))
                }
                disabled={updatingVersion}
                hitSlop={8}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={colors.burgundy[500]}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* PDF content */}
          <PDFViewer
            source={viewingPdf.uri}
            title={getTitle(viewingPdf.publication)}
            onPageChange={(page) => {
              publicationService.saveReadingPosition(
                viewingPdf.publication.id,
                page
              );
            }}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, isDesktop && styles.desktopHeader]}>
          {!isDesktop && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.burgundy[500]}
              />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>
            {t('publications.title') || 'Publications'}
          </Text>
        </View>

        {/* Sort tabs */}
        <View style={styles.sortTabs}>
          {(['latest', 'author', 'title'] as SortMode[]).map((mode) => {
            const isActive = sortMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.sortTab, isActive && styles.sortTabActive]}
                onPress={() => setSortMode(mode)}
              >
                <Text
                  style={[
                    styles.sortTabText,
                    isActive && styles.sortTabTextActive,
                  ]}
                >
                  {t(`publications.tabs.${mode}`) || mode}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Language filter chips */}
        {availableLanguages.length > 1 && (
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                !languageFilter && styles.filterChipActive,
              ]}
              onPress={() => setLanguageFilter(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !languageFilter && styles.filterChipTextActive,
                ]}
              >
                {t('publications.filters.all') || 'All'}
              </Text>
            </TouchableOpacity>
            {availableLanguages.map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.filterChip,
                  languageFilter === lang && styles.filterChipActive,
                ]}
                onPress={() =>
                  setLanguageFilter(languageFilter === lang ? null : lang)
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    languageFilter === lang && styles.filterChipTextActive,
                  ]}
                >
                  {lang}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.burgundy[500]} />
          </View>
        ) : filteredPublications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="book-outline"
              size={48}
              color={colors.gray[300]}
            />
            <Text style={styles.emptyText}>
              {t('publications.noPublications') ||
                'No publications available'}
            </Text>
          </View>
        ) : sortMode === 'author' ? (
          <SectionList
            sections={authorSections}
            keyExtractor={(item) => item.id}
            renderItem={renderPublicationItem}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
              </View>
            )}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
          />
        ) : (
          <FlatList
            data={filteredPublications}
            keyExtractor={(item) => item.id}
            renderItem={renderPublicationItem}
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Activation banner */}
        {hasHiddenPublications && !hasActiveSubscription && (
          <TouchableOpacity
            style={styles.activationBanner}
            onPress={() => router.push('/(tabs)/settings' as any)}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={colors.burgundy[500]}
            />
            <Text style={styles.activationText}>
              {t('publications.activateBanner') ||
                'Activate your account to access the full library'}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.burgundy[500]}
            />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  desktopHeader: {
    paddingTop: 32,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'MinionPro',
    color: colors.burgundy[500],
    fontVariant: ['small-caps'],
    letterSpacing: 0.5,
  },

  // Sort tabs
  sortTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 20,
  },
  sortTab: {
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  sortTabActive: {
    borderBottomColor: colors.burgundy[500],
  },
  sortTabText: {
    fontSize: 15,
    fontFamily: 'EBGaramond_400Regular',
    color: colors.gray[400],
    fontVariant: ['small-caps'],
    letterSpacing: 0.3,
  },
  sortTabTextActive: {
    color: colors.burgundy[500],
    fontFamily: 'EBGaramond_600SemiBold',
  },

  // Language filter
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: colors.white,
  },
  filterChipActive: {
    borderColor: colors.burgundy[500],
    backgroundColor: colors.burgundy[50],
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray[500],
  },
  filterChipTextActive: {
    color: colors.burgundy[500],
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Section header (author mode)
  sectionHeader: {
    paddingVertical: 10,
    paddingTop: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
    marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.burgundy[500],
    fontVariant: ['small-caps'],
  },

  // Publication item
  publicationItem: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
    alignItems: 'center',
  },
  coverContainer: {
    width: 60,
    height: 80,
    backgroundColor: colors.gray[100],
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
  },
  publicationInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  publicationTitle: {
    fontSize: 17,
    fontFamily: 'EBGaramond_500Medium',
    color: colors.gray[800],
    marginBottom: 3,
  },
  publicationSubtitle: {
    fontSize: 14,
    color: colors.gray[500],
    marginBottom: 2,
  },
  publicationLang: {
    fontSize: 12,
    color: colors.gray[400],
    marginTop: 2,
  },

  // Download indicator
  downloadIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  downloadText: {
    fontSize: 11,
    color: colors.burgundy[500],
    marginTop: 2,
  },

  // Loading / empty states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray[400],
    textAlign: 'center',
    marginTop: 12,
  },

  // Activation banner
  activationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.burgundy[50],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.burgundy[100],
    gap: 10,
  },
  activationText: {
    flex: 1,
    fontSize: 14,
    color: colors.burgundy[500],
    fontWeight: '500',
  },

  // PDF viewer header
  pdfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  pdfBackButton: {
    padding: 4,
    marginRight: 12,
  },
  pdfHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.gray[800],
  },

  // New-version banner inside PDF viewer
  versionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.burgundy[50],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.burgundy[100],
    gap: 10,
  },
  versionBannerText: {
    flex: 1,
  },
  versionBannerTitle: {
    fontSize: 14,
    color: colors.burgundy[500],
    fontWeight: '600',
  },
  versionBannerSubtitle: {
    fontSize: 12,
    color: colors.burgundy[500],
    opacity: 0.8,
    marginTop: 1,
  },
  versionUpdateButton: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionUpdateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  versionUpdateText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  versionDismissButton: {
    padding: 4,
  },
});
