import { useAuth } from "@/contexts/AuthContext";
import { getRowPressDelayProps } from '@/components/ui/ListRowPressable';
import { useLanguage } from "@/contexts/LanguageContext";
import eventBookmarkService, { EventBookmark } from "@/services/eventBookmarkService";
import trackBookmarkService, { TrackBookmark } from "@/services/trackBookmarkService";
import videoBookmarkService, { VideoBookmark } from "@/services/videoBookmarkService";
import { readerStateService, type PageBookmark } from "@/services/readerStateService";
import type { EventVideo } from "@/types";
import { formatVideoPosition } from "@/utils/formatVideoPosition";
import { isWholeVideoBookmark } from "@/utils/wholeVideoBookmark";
import { getVideoTitle } from "@/utils/videoTitle";
import { getTrackTitle, Language } from "@/utils/i18n";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { EventRow, EventThumb } from "@/components/EventRow";
import { useDesktopLayout } from "@/hooks/useDesktopLayout";
import { desktopLineBleed, desktopRowBleed, RULE_RIGHT_INSET, SUBDIVISION_COLOR, SUBDIVISION_THICKNESS, TEXT_GUTTER } from "@/constants/layout";
import { SectionRule } from "@/components/ui/SectionRule";
import { teacherFeedImageCacheKey } from "@/utils/cacheKeys";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const colors = {
  burgundy: { 500: "#9b1b1b" },
  gray: { 100: "#f3f4f6", 200: "#e5e7eb", 400: "#9ca3af", 500: "#6b7280", 600: "#4b5563", 700: "#374151", 800: "#2c2c2c" },
  white: "#ffffff",
};

function formatDate(dateStr: string | null | undefined, language: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return "";
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

// ── Event row ───────────────────────────────────────────────────────────

function BookmarkedEventRow({
  bookmark,
  onPress,
  language,
  testID,
}: {
  bookmark: EventBookmark;
  onPress: () => void;
  language: string;
  testID?: string;
}) {
  const { isDesktop } = useDesktopLayout();
  const event = bookmark.event;
  const title =
    (language === "pt" && event.name_translations?.pt) ||
    event.name ||
    event.name_translations?.en ||
    "";

  return (
    <EventRow
      event={event}
      title={title}
      meta={formatDate(event.startDate, language)}
      onPress={onPress}
      isDesktop={isDesktop}
      desktopPad={0}
      desktopInset={TEXT_GUTTER}
      testID={testID}
    />
  );
}

// ── Track row ───────────────────────────────────────────────────────────

function TrackRow({
  bookmark,
  onPress,
  language,
  testID,
}: {
  bookmark: TrackBookmark;
  onPress: () => void;
  language: Language;
  testID?: string;
}) {
  const { isDesktop } = useDesktopLayout();
  const track = bookmark.track;
  const event = track.event;
  const eventTitle = (language === "pt" && event.titlePt) || event.titleEn || "";
  const sessionTitle =
    (language === "pt" && track.session.titlePt) ||
    track.session.titleEn ||
    "";
  const teacher = event.teachers?.[0];
  const teacherPhoto = teacher?.avatarUrl || teacher?.photoUrl || null;

  const subtitle = [eventTitle, sessionTitle].filter(Boolean).join(" — ");

  return (
    <TouchableOpacity {...getRowPressDelayProps()} onPress={onPress} style={[styles.row, isDesktop && styles.rowDesktop]} testID={testID}>
      <EventThumb
        uri={teacherPhoto}
        cacheKey={teacherFeedImageCacheKey(teacher)}
      />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={2}>{getTrackTitle(track, language)}</Text>
        {subtitle ? (
          <Text style={styles.rowTeacher} numberOfLines={1}>{subtitle}</Text>
        ) : null}
        <Text style={styles.rowMeta}>
          {[formatDate(track.session.sessionDate, language), formatDuration(track.durationSeconds)]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Video row ───────────────────────────────────────────────────────────

function VideoRow({
  bookmark,
  onPress,
  language,
  t,
  testID,
}: {
  bookmark: VideoBookmark;
  onPress: () => void;
  language: Language;
  t: (key: string, params?: Record<string, unknown>) => string;
  testID?: string;
}) {
  const { isDesktop } = useDesktopLayout();
  const video = bookmark.video;
  const event = video.event;
  const eventTitle = (language === "pt" && event.titlePt) || event.titleEn || "";
  const teacher = event.teachers?.[0];
  const teacherPhoto = teacher?.avatarUrl || teacher?.photoUrl || null;

  // getVideoTitle only reads the title, date and position fields.
  const title = getVideoTitle(
    {
      id: video.id,
      eventId: video.eventId,
      bunnyVideoId: "",
      position: video.position,
      titleEn: video.titleEn,
      titlePt: video.titlePt,
      videoDate: video.videoDate,
      durationSeconds: video.durationSeconds,
      posterUrl: null,
      createdAt: "",
      updatedAt: "",
    } satisfies EventVideo,
    { language, t },
  );
  // A whole-video bookmark has no moment to show.
  const positionLabel = isWholeVideoBookmark(bookmark) ? "" : formatVideoPosition(bookmark.positionSeconds);
  const subtitle = [eventTitle, positionLabel]
    .filter(Boolean)
    .join(" — ");

  return (
    <TouchableOpacity {...getRowPressDelayProps()} onPress={onPress} style={[styles.row, isDesktop && styles.rowDesktop]} testID={testID}>
      <EventThumb
        uri={teacherPhoto}
        cacheKey={teacherFeedImageCacheKey(teacher)}
      />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
        {subtitle ? (
          <Text style={styles.rowTeacher} numberOfLines={1}>{subtitle}</Text>
        ) : null}
        {bookmark.note ? (
          <Text style={styles.rowMeta} numberOfLines={2}>{bookmark.note}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Page row ────────────────────────────────────────────────────────────

/** A bookmarked page of a publication or a transcript. */
function PageRow({
  bookmark,
  onPress,
  language,
  t,
  testID,
}: {
  bookmark: PageBookmark;
  onPress?: () => void;
  language: Language;
  t: (key: string, params?: Record<string, unknown>) => string;
  testID?: string;
}) {
  const { isDesktop } = useDesktopLayout();
  const doc = bookmark.document;
  const page = String(bookmark.page);
  const title =
    doc.type === "publication"
      ? doc.title
      : (language === "pt" && doc.event?.titlePt) || doc.event?.titleEn || doc.event?.titlePt || "";
  const subtitle =
    doc.type === "publication"
      ? t("bookmarks.publicationPage", { page }) || `Publication · page ${page}`
      : t("bookmarks.transcriptPage", { page }) || `Transcript · page ${page}`;

  return (
    <TouchableOpacity
      {...getRowPressDelayProps()}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, isDesktop && styles.rowDesktop]}
      testID={testID}
    >
      <EventThumb uri={null} fallbackIcon={doc.type === "publication" ? "book-outline" : "document-text-outline"} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.rowMeta}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** Where a page bookmark opens: its document, on that page. */
function openPageBookmark(bookmark: PageBookmark): (() => void) | undefined {
  const doc = bookmark.document;
  const page = String(bookmark.page);
  if (doc.type === "publication") {
    return () =>
      router.push({
        pathname: "/(tabs)/(groups)/publications",
        params: { open: String(doc.id), page },
      } as any);
  }
  // A transcript without an event has no reader screen to open it in.
  if (!doc.event) return undefined;
  const eventId = String(doc.event.id);
  return () =>
    router.push({
      pathname: "/(tabs)/(groups)/transcript/[id]",
      params: { id: eventId, transcript: String(doc.id), page },
    } as any);
}

// ── Screen ──────────────────────────────────────────────────────────────

export default function BookmarksScreen() {
  const { isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const { isDesktop } = useDesktopLayout();
  const [eventBookmarks, setEventBookmarks] = useState<EventBookmark[]>([]);
  const [trackBookmarks, setTrackBookmarks] = useState<TrackBookmark[]>([]);
  const [videoBookmarks, setVideoBookmarks] = useState<VideoBookmark[]>([]);
  const [pageBookmarks, setPageBookmarks] = useState<PageBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setEventBookmarks([]);
      setTrackBookmarks([]);
      setVideoBookmarks([]);
      setPageBookmarks([]);
      return;
    }
    setLoading(true);
    setError(null);
    const [eventsRes, tracksRes, videosRes, pagesRes] = await Promise.all([
      eventBookmarkService.list(),
      trackBookmarkService.list(),
      videoBookmarkService.list(),
      readerStateService.listAllBookmarks(),
    ]);
    if (eventsRes.success && eventsRes.data) setEventBookmarks(eventsRes.data);
    if (tracksRes.success && tracksRes.data) setTrackBookmarks(tracksRes.data);
    if (videosRes.success && videosRes.data) setVideoBookmarks(videosRes.data);
    if (pagesRes.success && pagesRes.data) setPageBookmarks(pagesRes.data);
    if (
      (!eventsRes.success && !eventsRes.authRequired) ||
      (!tracksRes.success && !tracksRes.authRequired) ||
      (!videosRes.success && !videosRes.authRequired) ||
      (!pagesRes.success && !pagesRes.authRequired)
    ) {
      setError(
        eventsRes.error ||
          tracksRes.error ||
          videosRes.error ||
          pagesRes.error ||
          (t("common.error") || "Something went wrong"),
      );
    }
    setLoading(false);
  }, [isAuthenticated, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const hasAny =
    eventBookmarks.length > 0 ||
    trackBookmarks.length > 0 ||
    videoBookmarks.length > 0 ||
    pageBookmarks.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, styles.indented]}>{t("navigation.bookmarks") || "Bookmarks"}</Text>
        <SectionRule contained={isDesktop} style={[styles.rule, isDesktop && desktopLineBleed(0)]} />

        {loading && !hasAny ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.burgundy[500]} />
          </View>
        ) : !isAuthenticated ? (
          <View style={styles.emptyState}>
            <Ionicons name="bookmark-outline" size={48} color={colors.gray[400]} />
            <Text style={styles.emptyTitle}>{t("player.bookmarks") || "Bookmarks"}</Text>
            <Text style={styles.emptyText}>
              {t("bookmarks.signInPrompt") || "Sign in to save bookmarks."}
            </Text>
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.gray[400]} />
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : !hasAny ? (
          <View style={styles.emptyState}>
            <Ionicons name="bookmark-outline" size={48} color={colors.gray[400]} />
            <Text style={styles.emptyTitle}>{t("player.bookmarks") || "Bookmarks"}</Text>
            <Text style={styles.emptyText}>
              {t("bookmarks.empty") ||
                "Tap the bookmark icon on an event or in the player to save it here."}
            </Text>
          </View>
        ) : (
          <>
            {/* Events section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, styles.indented]}>
                {t("bookmarks.eventsHeader") || "Events"}
              </Text>
              {eventBookmarks.length === 0 ? (
                <Text style={[styles.sectionEmpty, styles.indented]}>
                  {t("bookmarks.noEventBookmarks") || "No bookmarked events yet."}
                </Text>
              ) : (
                eventBookmarks.map((bm) => (
                  <BookmarkedEventRow
                    key={`event-${bm.id}`}
                    bookmark={bm}
                    language={language}
                    testID={`bookmark-${bm.id}`}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/(groups)/retreat/[id]",
                        params: { id: String(bm.eventId), from: "bookmarks" },
                      } as any)
                    }
                  />
                ))
              )}
            </View>

            {/* Tracks section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, styles.indented]}>
                {t("bookmarks.tracksHeader") || "Tracks"}
              </Text>
              {trackBookmarks.length === 0 ? (
                <Text style={[styles.sectionEmpty, styles.indented]}>
                  {t("bookmarks.noTrackBookmarks") || "No bookmarked tracks yet."}
                </Text>
              ) : (
                trackBookmarks.map((bm) => (
                  <TrackRow
                    key={`track-${bm.id}`}
                    bookmark={bm}
                    language={language}
                    testID={`bookmark-${bm.id}`}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/(groups)/retreat/[id]",
                        params: {
                          id: String(bm.track.event.id),
                          from: "bookmarks",
                          trackId: String(bm.trackId),
                        },
                      } as any)
                    }
                  />
                ))
              )}
            </View>

            {/* Videos section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, styles.indented]}>
                {t("bookmarks.videosHeader") || "Videos"}
              </Text>
              {videoBookmarks.length === 0 ? (
                <Text style={[styles.sectionEmpty, styles.indented]}>
                  {t("bookmarks.noVideoBookmarks") || "No bookmarked videos yet."}
                </Text>
              ) : (
                videoBookmarks.map((bm) => (
                  <VideoRow
                    key={`video-${bm.id}`}
                    bookmark={bm}
                    language={language}
                    t={t}
                    testID={`video-bookmark-${bm.id}`}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/(groups)/retreat/[id]",
                        params: {
                          id: String(bm.video.event.id),
                          from: "bookmarks",
                          videoId: String(bm.videoId),
                          // A whole-video bookmark opens where the user left off.
                          ...(isWholeVideoBookmark(bm) ? {} : { position: String(bm.positionSeconds) }),
                        },
                      } as any)
                    }
                  />
                ))
              )}
            </View>

            {/* Pages section: bookmarked pages of publications and transcripts */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, styles.indented]}>
                {t("bookmarks.pagesHeader") || "Pages"}
              </Text>
              {pageBookmarks.length === 0 ? (
                <Text style={[styles.sectionEmpty, styles.indented]}>
                  {t("bookmarks.noPageBookmarks") || "No bookmarked pages yet."}
                </Text>
              ) : (
                pageBookmarks.map((bm) => (
                  <PageRow
                    key={`page-${bm.documentType}-${bm.documentId}-${bm.page}`}
                    bookmark={bm}
                    language={language}
                    t={t}
                    testID={`page-bookmark-${bm.documentType}-${bm.documentId}-${bm.page}`}
                    onPress={openPageBookmark(bm)}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollView: {
    flex: 1,
  },
  // Content runs edge to edge: text is indented per element so that row
  // separators can start at the left screen edge.
  scrollContent: {
    paddingTop: 60,
    paddingBottom: 100,
  },
  indented: {
    paddingHorizontal: TEXT_GUTTER,
  },
  title: {
    fontSize: 28,
    fontFamily: "MinionPro",
    color: colors.burgundy[500],
    marginBottom: 12,
    fontVariant: ["small-caps"],
  },
  center: {
    paddingTop: 80,
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "EBGaramond_600SemiBold",
    color: colors.gray[800],
  },
  emptyText: {
    fontSize: 15,
    color: colors.gray[500],
    textAlign: "center",
  },
  rule: {
    marginBottom: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: "EBGaramond_600SemiBold",
    color: colors.gray[500],
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionEmpty: {
    fontSize: 14,
    color: colors.gray[400],
    fontStyle: "italic",
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: TEXT_GUTTER,
    marginRight: RULE_RIGHT_INSET,
    borderBottomWidth: SUBDIVISION_THICKNESS,
    borderBottomColor: SUBDIVISION_COLOR,
  },
  // Desktop: the separator runs the column's width (the text keeps its gutter).
  rowDesktop: desktopRowBleed(0, TEXT_GUTTER, TEXT_GUTTER),
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: "EBGaramond_600SemiBold",
    color: colors.gray[800],
    marginBottom: 2,
  },
  rowTeacher: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 2,
  },
  rowMeta: {
    fontSize: 13,
    color: colors.gray[500],
  },
});
