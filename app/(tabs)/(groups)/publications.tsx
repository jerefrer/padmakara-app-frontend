import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { publicationCoverCacheKey } from '@/utils/cacheKeys';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSignIn } from '@/components/auth/SignInProvider';
import { publicationService } from '@/services/publicationService';
import { PDFViewer } from '@/components/PDFViewer';
import { colors } from '@/constants/colors';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import type { Publication } from '@/types';
import { BackButton } from '@/components/ui/BackButton';
import { RULE_RIGHT_INSET, SUBDIVISION_COLOR, SUBDIVISION_THICKNESS, TEXT_GUTTER } from '@/constants/layout';
import { SectionRule } from '@/components/ui/SectionRule';
import { TabSwitcher } from '@/components/ui/TabSwitcher';

type SortMode = 'title' | 'author' | 'latest';

export default function PublicationsScreen() {
  const { t } = useLanguage();
  const { isAuthenticated, hasActiveSubscription } = useAuth();
  const { openSignIn } = useSignIn();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useDesktopLayout();

  const [publications, setPublications] = useState<Publication[]>(() => {
    const sync = publicationService.getPublicationsSync();
    return sync ? sync.publications : [];
  });
  const [hasHiddenPublications, setHasHiddenPublications] = useState(false);
  // Show spinner only when the lazy initializer found nothing in the mirror.
  const [loading, setLoading] = useState(() =>
    publicationService.getPublicationsSync() === null
  );
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);

  // Language dropdown
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

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

  // Load publications — cache-first; spinner only on cold load (nothing yet displayed).
  useEffect(() => {
    let cancelled = false;

    // Show spinner only when the lazy initializer found nothing in the mirror.
    if (publications.length === 0) setLoading(true);

    publicationService
      .getPublications()
      .then(({ publications: data, hasHiddenPublications: hidden }) => {
        if (!cancelled) {
          setPublications(data);
          setHasHiddenPublications(hidden);
        }
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

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const { publications: data, hasHiddenPublications: hidden } =
        await publicationService.getPublications(undefined, undefined, { force: true });
      setPublications(data);
      setHasHiddenPublications(hidden);
    } catch (err) {
      console.error('Failed to refresh publications:', err);
    } finally {
      setRefreshing(false);
    }
  };

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

  // Resolve a language code to its localized full name (falls back to the code).
  const getLanguageLabel = useCallback(
    (code: string) => {
      const translated = t(`publications.languages.${code.toLowerCase()}`);
      return translated || code;
    },
    [t]
  );

  const handleSelectLanguage = useCallback((lang: string | null) => {
    setLanguageFilter(lang);
    setShowLanguageDropdown(false);
  }, []);

  // Render a publication item
  const renderPublicationItem = useCallback(
    ({ item }: { item: Publication }) => {
      const title = getTitle(item);
      const authorLine = item.authors?.join(', ') || '';
      const isDownloading = downloading === item.id;

      return (
        <TouchableOpacity
          style={[styles.publicationItem, !isDesktop && styles.rowToInset]}
          onPress={() => handleOpenPublication(item)}
          disabled={isDownloading}
          activeOpacity={0.7}
        >
          {/* Cover thumbnail */}
          <View style={styles.coverContainer}>
            {item.coverImageUrl ? (
              <Image
                source={{ uri: item.coverImageUrl, cacheKey: publicationCoverCacheKey(item) }}
                cachePolicy="memory-disk"
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
    [getTitle, downloading, downloadProgress, handleOpenPublication, t, isDesktop]
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
            <BackButton variant="inline" onPress={() => setViewingPdf(null)} />
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

  // The floating native tab bar covers the bottom of the screen, so there the
  // banner opens the list instead of sitting under it.
  const bannerAtTop = Platform.OS !== 'web';

  // Members banner: web leads to /membership; native (reader app) only
  // offers sign-in to signed-out users and says nothing to signed-in non-members.
  const membersBanner =
    hasHiddenPublications && !hasActiveSubscription && (Platform.OS === 'web' || !isAuthenticated) ? (
      <TouchableOpacity
        testID="publications-members-banner"
        style={[styles.activationBanner, bannerAtTop && styles.activationBannerTop]}
        onPress={() => (Platform.OS === 'web' ? router.push('/membership' as any) : openSignIn())}
      >
        <Ionicons
          name="lock-closed-outline"
          size={18}
          color={colors.burgundy[500]}
        />
        <Text style={styles.activationText}>
          {Platform.OS === 'web'
            ? t('publications.memberBanner') ||
              'Become a member to access the full library'
            : t('publications.activateBanner') ||
              'Activate your account to access the full library'}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.burgundy[500]}
        />
      </TouchableOpacity>
    ) : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, isDesktop && styles.desktopHeader]}>
          {!isDesktop && (
            <BackButton variant="inline" />
          )}
          <Text style={styles.headerTitle}>
            {t('publications.title') || 'Publications'}
          </Text>
        </View>

        {/* Red rule under the header; rows below get thin dark lines. */}
        {!isDesktop && <SectionRule />}

        {/* Sort tabs + language dropdown */}
        <TabSwitcher<SortMode>
          bleed={!isDesktop}
          style={[styles.sortBar, isDesktop && styles.sortBarDesktop]}
          activeKey={sortMode}
          onChange={setSortMode}
          tabs={(['latest', 'author', 'title'] as SortMode[]).map((mode) => ({
            key: mode,
            label: t(`publications.tabs.${mode}`) || mode,
            testID: `publications-tab-${mode}`,
          }))}
          trailing={
          availableLanguages.length > 1 ? (
            <View style={[styles.languageDropdownContainer, !isDesktop && styles.languageToGutter]}>
              <TouchableOpacity
                testID="publications-language-button"
                style={styles.languageTrigger}
                onPress={() => setShowLanguageDropdown((v) => !v)}
                activeOpacity={0.7}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  languageFilter
                    ? t('publications.filters.languageButtonActive', { language: getLanguageLabel(languageFilter) }) ||
                      `Filter by language, showing ${getLanguageLabel(languageFilter)}`
                    : t('publications.filters.languageButton') || 'Filter by language'
                }
                accessibilityState={{ expanded: showLanguageDropdown }}
              >
                <Ionicons
                  name="globe-outline"
                  size={22}
                  color={languageFilter ? colors.burgundy[500] : colors.gray[500]}
                />
                {languageFilter && <View testID="publications-language-badge" style={styles.languageBadge} />}
              </TouchableOpacity>
              {showLanguageDropdown && (
                <View style={styles.languageDropdown}>
                  <TouchableOpacity
                    style={[
                      styles.languageDropdownItem,
                      !languageFilter && styles.languageDropdownItemActive,
                    ]}
                    onPress={() => handleSelectLanguage(null)}
                  >
                    <Text
                      style={[
                        styles.languageDropdownItemText,
                        !languageFilter && styles.languageDropdownItemTextActive,
                      ]}
                    >
                      {t('publications.filters.allLanguages') || 'All languages'}
                    </Text>
                    {!languageFilter && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={colors.burgundy[500]}
                      />
                    )}
                  </TouchableOpacity>
                  {availableLanguages.map((lang) => {
                    const isActive = languageFilter === lang;
                    return (
                      <TouchableOpacity
                        key={lang}
                        style={[
                          styles.languageDropdownItem,
                          isActive && styles.languageDropdownItemActive,
                        ]}
                        onPress={() => handleSelectLanguage(lang)}
                      >
                        <Text
                          style={[
                            styles.languageDropdownItemText,
                            isActive && styles.languageDropdownItemTextActive,
                          ]}
                        >
                          {getLanguageLabel(lang)}
                        </Text>
                        {isActive && (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={colors.burgundy[500]}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null
          }
        />

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.burgundy[500]} />
          </View>
        ) : filteredPublications.length === 0 ? (
          <>
          {bannerAtTop && membersBanner}
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
          </>
        ) : sortMode === 'author' ? (
          <SectionList
            sections={authorSections}
            keyExtractor={(item) => item.id}
            renderItem={renderPublicationItem}
            renderSectionHeader={({ section: { title } }) => (
              <View style={[styles.sectionHeader, !isDesktop && styles.rowToInset]}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
              </View>
            )}
            ListHeaderComponent={bannerAtTop ? membersBanner : null}
            contentContainerStyle={isDesktop ? styles.listContentDesktop : styles.listContent}
            stickySectionHeadersEnabled={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        ) : (
          <FlatList
            data={filteredPublications}
            keyExtractor={(item) => item.id}
            renderItem={renderPublicationItem}
            ListHeaderComponent={bannerAtTop ? membersBanner : null}
            contentContainerStyle={isDesktop ? styles.listContentDesktop : styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}

        {!bannerAtTop && membersBanner}
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
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  desktopHeader: {
    paddingTop: 42,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: 'MinionPro',
    color: colors.burgundy[500],
    fontVariant: ['small-caps'],
    letterSpacing: 0.5,
  },

  // Sort tabs (shared TabSwitcher) with the language dropdown at the right.
  // position:relative + zIndex are required so the absolutely-positioned
  // dropdown menu rendered inside this row sits above the FlatList that
  // follows in the DOM (otherwise clicks pass through to list items on web).
  sortBar: {
    position: 'relative',
    zIndex: 100,
  },
  sortBarDesktop: {
    marginHorizontal: 24,
  },
  // The tab line stops at the right inset; the dropdown trigger lines up with
  // the text gutter again.
  languageToGutter: {
    marginRight: -(RULE_RIGHT_INSET - TEXT_GUTTER),
  },

  // Language dropdown — anchored absolutely to its container, mirroring
  // the language picker pattern used on the event hero.
  languageDropdownContainer: {
    position: 'relative',
    zIndex: 100,
  },
  languageTrigger: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  // Small burgundy dot on the globe while a language filter is active.
  languageBadge: {
    position: 'absolute',
    top: 4,
    right: 1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.burgundy[500],
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  languageDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 200,
    overflow: 'hidden',
  },
  languageDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[100],
  },
  languageDropdownItemActive: {
    backgroundColor: colors.burgundy[50],
  },
  languageDropdownItemText: {
    fontSize: 14,
    color: colors.gray[700],
  },
  languageDropdownItemTextActive: {
    fontWeight: '600',
    color: colors.burgundy[500],
  },

  // List
  // Mobile rows run edge to edge: the thumbnail is indented per row so that
  // separators can start at the left screen edge and stop at the right inset.
  listContent: {
    paddingBottom: 100,
  },
  listContentDesktop: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  rowToInset: {
    marginRight: RULE_RIGHT_INSET,
    paddingLeft: TEXT_GUTTER,
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
    borderBottomWidth: SUBDIVISION_THICKNESS,
    borderBottomColor: SUBDIVISION_COLOR,
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
  activationBannerTop: {
    borderTopWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.burgundy[100],
    marginBottom: 8,
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
