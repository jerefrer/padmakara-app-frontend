import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import eventBookmarkService, { EventBookmark } from "@/services/eventBookmarkService";
import trackBookmarkService, { TrackBookmark } from "@/services/trackBookmarkService";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
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

function EventRow({
  bookmark,
  onPress,
  language,
}: {
  bookmark: EventBookmark;
  onPress: () => void;
  language: string;
}) {
  const event = bookmark.event;
  const title =
    (language === "pt" && event.name_translations?.pt) ||
    event.name ||
    event.name_translations?.en ||
    "";
  const teacherNames = event.teachers?.map((tt: any) => tt.name).filter(Boolean).join(", ") || "";
  const teacherPhoto =
    event.teachers?.[0]?.avatarUrl || event.teachers?.[0]?.photoUrl || null;

  return (
    <TouchableOpacity onPress={onPress} style={styles.row}>
      <View style={styles.avatar}>
        {teacherPhoto ? (
          <Image source={{ uri: teacherPhoto }} style={styles.avatarImg} contentFit="cover" />
        ) : (
          <View style={[styles.avatarImg, styles.avatarFallback]}>
            <Ionicons name="bookmark" size={20} color={colors.gray[400]} />
          </View>
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
        {teacherNames ? (
          <Text style={styles.rowTeacher} numberOfLines={1}>{teacherNames}</Text>
        ) : null}
        <Text style={styles.rowMeta}>{formatDate(event.startDate, language)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Track row ───────────────────────────────────────────────────────────

function TrackRow({
  bookmark,
  onPress,
  language,
}: {
  bookmark: TrackBookmark;
  onPress: () => void;
  language: string;
}) {
  const track = bookmark.track;
  const event = track.event;
  const eventTitle = (language === "pt" && event.titlePt) || event.titleEn || "";
  const sessionTitle =
    (language === "pt" && track.session.titlePt) ||
    track.session.titleEn ||
    "";
  const teacherPhoto =
    event.teachers?.[0]?.avatarUrl || event.teachers?.[0]?.photoUrl || null;

  const subtitle = [eventTitle, sessionTitle].filter(Boolean).join(" — ");

  return (
    <TouchableOpacity onPress={onPress} style={styles.row}>
      <View style={styles.avatar}>
        {teacherPhoto ? (
          <Image source={{ uri: teacherPhoto }} style={styles.avatarImg} contentFit="cover" />
        ) : (
          <View style={[styles.avatarImg, styles.avatarFallback]}>
            <Ionicons name="musical-notes-outline" size={20} color={colors.gray[400]} />
          </View>
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={2}>{track.title}</Text>
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

// ── Screen ──────────────────────────────────────────────────────────────

export default function BookmarksScreen() {
  const { isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const [eventBookmarks, setEventBookmarks] = useState<EventBookmark[]>([]);
  const [trackBookmarks, setTrackBookmarks] = useState<TrackBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setEventBookmarks([]);
      setTrackBookmarks([]);
      return;
    }
    setLoading(true);
    setError(null);
    const [eventsRes, tracksRes] = await Promise.all([
      eventBookmarkService.list(),
      trackBookmarkService.list(),
    ]);
    if (eventsRes.success && eventsRes.data) setEventBookmarks(eventsRes.data);
    if (tracksRes.success && tracksRes.data) setTrackBookmarks(tracksRes.data);
    if ((!eventsRes.success && !eventsRes.authRequired) || (!tracksRes.success && !tracksRes.authRequired)) {
      setError(eventsRes.error || tracksRes.error || (t("common.error") || "Something went wrong"));
    }
    setLoading(false);
  }, [isAuthenticated, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const hasAny = eventBookmarks.length > 0 || trackBookmarks.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t("navigation.bookmarks") || "Bookmarks"}</Text>

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
              <Text style={styles.sectionHeader}>
                {t("bookmarks.eventsHeader") || "Events"}
              </Text>
              {eventBookmarks.length === 0 ? (
                <Text style={styles.sectionEmpty}>
                  {t("bookmarks.noEventBookmarks") || "No bookmarked events yet."}
                </Text>
              ) : (
                eventBookmarks.map((bm) => (
                  <EventRow
                    key={`event-${bm.id}`}
                    bookmark={bm}
                    language={language}
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
              <Text style={styles.sectionHeader}>
                {t("bookmarks.tracksHeader") || "Tracks"}
              </Text>
              {trackBookmarks.length === 0 ? (
                <Text style={styles.sectionEmpty}>
                  {t("bookmarks.noTrackBookmarks") || "No bookmarked tracks yet."}
                </Text>
              ) : (
                trackBookmarks.map((bm) => (
                  <TrackRow
                    key={`track-${bm.id}`}
                    bookmark={bm}
                    language={language}
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontFamily: "MinionPro",
    color: colors.burgundy[500],
    marginBottom: 24,
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
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gray[100],
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
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
