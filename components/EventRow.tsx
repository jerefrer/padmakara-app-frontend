import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { DraftBadge } from "@/components/DraftBadge";
import { NowPlayingBadge } from "@/components/NowPlayingBadge";
import { AVENIR_FAMILY } from "@/constants/avenirFont";
import { RULE_RIGHT_INSET, TEXT_GUTTER } from "@/constants/layout";
import type { Gathering } from "@/types";
import { teacherFeedImageCacheKey } from "@/utils/cacheKeys";

const colors = {
  burgundy: "#9b1b1b",
  gray: { 200: "#e5e7eb", 400: "#9ca3af", 500: "#6b7280", 800: "#2c2c2c" },
};

/**
 * Does this event have audio tracks?
 *
 * The authenticated `/events` list that backs the entity cache omits
 * `sessions` entirely (only the featured/public endpoints embed them), so an
 * absent `sessions` field means "unknown", not "no audio". Treat unknown as
 * audio: every event used to show the note icon unconditionally, and hiding
 * it on the cache path would be a regression.
 */
export function eventHasAudio(event: Pick<Gathering, "sessions">): boolean {
  if (event.sessions === undefined) return true;
  return event.sessions.some((s) => (s.tracks?.length ?? 0) > 0);
}

/** Square list thumbnail shared by every row that stands for a teaching. */
export function EventThumb({
  uri,
  cacheKey,
  fallbackIcon = "musical-notes-outline",
  isDesktop,
}: {
  uri: string | null;
  cacheKey?: string;
  fallbackIcon?: React.ComponentProps<typeof Ionicons>["name"];
  isDesktop?: boolean;
}) {
  return (
    <View style={[styles.thumb, !isDesktop && styles.thumbIndented]}>
      {uri ? (
        <Image
          source={{ uri, cacheKey }}
          cachePolicy="memory-disk"
          transition={0}
          style={styles.thumbImage}
          contentFit="cover"
        />
      ) : (
        <View style={styles.thumbPlaceholder}>
          <Ionicons name={fallbackIcon} size={28} color={colors.gray[400]} />
        </View>
      )}
    </View>
  );
}

interface EventRowProps {
  event: Gathering;
  title: string;
  /** Gray line under the teacher names, already formatted by the caller. */
  meta: string;
  onPress: () => void;
  /** Extra badge next to the title (e.g. the offline badge). */
  badge?: React.ReactNode;
  /** Desktop columns have their own padding: no gutter, no right inset. */
  isDesktop?: boolean;
  testID?: string;
}

/**
 * One row per teaching/event: square thumbnail, black title, red teacher
 * names, gray meta line, then the video / audio / transcript icons. The
 * separator starts at the left edge and stops at the right inset (see
 * constants/layout.ts).
 */
export function EventRow({ event, title, meta, onPress, badge, isDesktop, testID }: EventRowProps) {
  const teacherNames =
    event.teachers?.map((t: any) => t.name || t.nameEn || "").filter(Boolean).join(", ") || "";
  const teacher = event.teachers?.[0];
  const image = teacher?.avatarUrl || teacher?.photoUrl || null;

  const hasTranscripts = (event.transcripts?.length ?? 0) > 0;
  const hasVideo = (event.videos?.length ?? 0) > 0;
  const hasAudio = eventHasAudio(event);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.row, !isDesktop && styles.rowToInset]}
      testID={testID}
    >
      <EventThumb
        uri={image}
        cacheKey={teacher ? teacherFeedImageCacheKey(teacher) : undefined}
        isDesktop={isDesktop}
      />
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {event.status === "draft" && <DraftBadge />}
          {badge}
        </View>
        <NowPlayingBadge eventId={event.id} />
        {teacherNames ? (
          <Text style={styles.teacher} numberOfLines={1}>
            {teacherNames}
          </Text>
        ) : null}
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        <View style={styles.icons}>
          {hasVideo && <Ionicons name="videocam-outline" size={14} color={colors.gray[400]} />}
          {hasAudio && <Ionicons name="musical-notes-outline" size={14} color={colors.gray[400]} />}
          {hasTranscripts && <Ionicons name="book-outline" size={14} color={colors.gray[400]} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  // The separator starts at the left edge and stops at the right inset.
  rowToInset: {
    marginRight: RULE_RIGHT_INSET,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
    marginRight: 14,
  },
  // List thumbnails keep the text margin: small squares against the screen
  // edge make the list look lopsided.
  thumbIndented: {
    marginLeft: TEXT_GUTTER,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontFamily: "EBGaramond_500Medium",
    color: colors.gray[800],
    flex: 1,
  },
  teacher: {
    fontSize: 15,
    fontFamily: "EBGaramond_400Regular",
    color: colors.burgundy,
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    fontFamily: AVENIR_FAMILY,
    color: colors.gray[500],
  },
  icons: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
  },
});
