import React from "react";
import { getRowPressDelayProps } from '@/components/ui/ListRowPressable';
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { DraftBadge } from "@/components/DraftBadge";
import { ForthcomingBadge } from "@/components/ForthcomingBadge";
import { NowPlayingBadge } from "@/components/NowPlayingBadge";
import { AVENIR_FAMILY } from "@/constants/avenirFont";
import {
  RULE_LEFT_INSET,
  RULE_RIGHT_INSET,
  SUBDIVISION_COLOR,
  SUBDIVISION_THICKNESS,
} from "@/constants/layout";
import type { Gathering } from "@/types";
import { eventAvatarCacheKey, teacherFeedImageCacheKey } from "@/utils/cacheKeys";
import { pickEventPhoto, pickThumbTeacher } from "@/utils/heroVariant";
import { mainTeachers } from "@/utils/eventTeachers";

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
}: {
  uri: string | null;
  cacheKey?: string;
  fallbackIcon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={styles.thumb}>
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
  /** Desktop columns have their own padding: the row fills it, no gutter. */
  isDesktop?: boolean;
  testID?: string;
  /** Title size override, for screens whose neighbouring rows use another size. */
  titleFontSize?: number;
}

/**
 * One row per teaching/event: square thumbnail, black title, red teacher
 * names, gray meta line, then the video / audio / transcript icons. The light
 * separator runs from the thumbnail's left edge to the right gutter (see
 * constants/layout.ts).
 */
export function EventRow({ event, title, meta, onPress, badge, isDesktop, testID, titleFontSize }: EventRowProps) {
  // Compact row: the main teachers only, never the guests (see utils/eventTeachers).
  const teacherNames =
    mainTeachers(event.teachers).map((t: any) => t.name || t.nameEn || "").filter(Boolean).join(", ") || "";
  const teacher = pickThumbTeacher(event.teachers, event.photoTeacherId);
  // The event's own photo replaces the teacher's face in the list.
  const eventPhoto = pickEventPhoto(event);
  const image = eventPhoto
    ? eventPhoto.avatarUrl || eventPhoto.heroMobileUrl || eventPhoto.heroUrl || null
    : teacher?.avatarUrl || teacher?.photoUrl || null;
  const thumbCacheKey = eventPhoto
    ? eventPhoto.avatarUrl
      ? eventAvatarCacheKey(event, eventPhoto)
      : undefined
    : teacher
      ? teacherFeedImageCacheKey(teacher)
      : undefined;

  const hasTranscripts = (event.transcripts?.length ?? 0) > 0;
  const hasVideo = (event.videos?.length ?? 0) > 0;
  const hasAudio = eventHasAudio(event);

  return (
    <TouchableOpacity {...getRowPressDelayProps()}
      onPress={onPress}
      style={[styles.row, isDesktop ? styles.rowDesktop : styles.rowToInset]}
      testID={testID}
    >
      <View style={styles.main}>
        <EventThumb uri={image} cacheKey={thumbCacheKey} />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, titleFontSize !== undefined && { fontSize: titleFontSize }]} numberOfLines={2}>
              {title}
            </Text>
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
      </View>
      {/* The status badge sits under the picture: next to the title it overlapped it. */}
      {(event.status === "draft" || event.status === "forthcoming") && (
        <View style={styles.statusBadge}>
          {event.status === "draft" ? <DraftBadge /> : <ForthcomingBadge />}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    borderBottomWidth: SUBDIVISION_THICKNESS,
    borderBottomColor: SUBDIVISION_COLOR,
  },
  // Phone: the separator spans the text column, gutter to gutter.
  rowToInset: {
    marginLeft: RULE_LEFT_INSET,
    marginRight: RULE_RIGHT_INSET,
  },
  // Desktop: the column already pads the row, so the separator spans it as is.
  rowDesktop: {},
  // Picture and text side by side; the status badge, when there is one, hangs under the picture.
  main: {
    flexDirection: "row",
  },
  statusBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
    marginRight: 14,
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
