import { useAuth } from "@/contexts/AuthContext";
import { useSignIn } from '@/components/auth/SignInProvider';
import { useLanguage } from "@/contexts/LanguageContext";
import retreatService from "@/services/retreatService";
import { teachingService } from "@/services/teachingService";
import { Gathering, RetreatGroup } from "@/types";
import { getTranslatedName } from "@/utils/i18n";
import { groupThumbnailSource } from "@/utils/groupThumbnail";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDesktopLayout } from "@/hooks/useDesktopLayout";
import { BackButton } from '@/components/ui/BackButton';
import { EventRow } from '@/components/EventRow';
import { RULE_RIGHT_INSET, SUBDIVISION_COLOR, SUBDIVISION_THICKNESS, TEXT_GUTTER } from '@/constants/layout';
import { SectionRule } from '@/components/ui/SectionRule';
import { getRowPressDelayProps } from '@/components/ui/ListRowPressable';

// Same width as the square teaching thumbnails (EventThumb), so both lists align.
const AVATAR_SIZE = 80;
// Teaching titles use the retreat-group name size on this screen.
const GROUP_NAME_FONT_SIZE = 17;

const INFO_EMAIL = "info@padmakara.pt";

const colors = {
  burgundy: { 500: "#9b1b1b", 600: "#7b1616" },
  gray: {
    200: "#e5e7eb",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#2c2c2c",
  },
  white: "#ffffff",
};

// ── Group Avatar Images ──────────────────────────────────────────────────────

const GROUP_IMAGES: Record<string, any> = {
  shine: require("@/assets/images/groups/shine.jpeg"),
  mandala: require("@/assets/images/groups/mandala.jpeg"),
  vajrasattva: require("@/assets/images/groups/vajrasattva.jpeg"),
  shakyamuni: require("@/assets/images/groups/shakyamuni.jpeg"),
  "guru-yoga": require("@/assets/images/groups/guru-yoga.jpeg"),
  "ngulchu-thogme": require("@/assets/images/groups/ngulchu-thogme.jpeg"),
  "three-jewels": require("@/assets/images/groups/chenrezi.jpeg"),
};

function getGroupImage(groupName: string): any | null {
  const name = groupName.toLowerCase();
  if (name.includes("shamatha") || name.includes("śamatha"))
    return GROUP_IMAGES["shine"];
  if (name.includes("mandala")) return GROUP_IMAGES["mandala"];
  if (name.includes("vajrasattva")) return GROUP_IMAGES["vajrasattva"];
  if (name.includes("shakyamuni") || name.includes("śākyamuni"))
    return GROUP_IMAGES["shakyamuni"];
  if (
    name.includes("guru yoga") ||
    name.includes("tsikdun") ||
    name.includes("tsik dün")
  )
    return GROUP_IMAGES["guru-yoga"];
  if (
    name.includes("mind training") ||
    name.includes("bodhisattva") ||
    name.includes("lojong") ||
    name.includes("37 practices")
  )
    return GROUP_IMAGES["ngulchu-thogme"];
  if (
    name.includes("refuge") ||
    name.includes("three jewels") ||
    name.includes("refúgio")
  )
    return GROUP_IMAGES["three-jewels"];
  return null;
}

// ── Group Row ────────────────────────────────────────────────────────────────

interface GroupRowProps {
  group: RetreatGroup;
  onPress: () => void;
  language: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  isDesktop?: boolean;
}

function GroupRow({ group, onPress, language, t, isDesktop }: GroupRowProps) {
  const retreatCount = group.gatherings?.length || 0;
  const groupName = getTranslatedName(group, language as "en" | "pt");
  const groupImage = groupThumbnailSource(group, getGroupImage(groupName));

  return (
    <TouchableOpacity {...getRowPressDelayProps()} onPress={onPress} style={[styles.groupRow, !isDesktop && styles.groupRowIndented]} testID={`group-card-${group.id}`}>
      {/* Round avatar */}
      <View style={styles.avatarContainer}>
        {groupImage ? (
          <Image
            source={groupImage}
            style={styles.avatar}
            contentFit="cover"
            testID={`group-avatar-${group.id}`}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]} testID={`group-avatar-${group.id}`}>
            <Ionicons name="leaf-outline" size={28} color={colors.gray[400]} />
          </View>
        )}
      </View>

      {/* Name and count */}
      <View style={styles.groupInfo}>
        <Text style={styles.groupName} numberOfLines={1}>
          {groupName}
        </Text>
        <Text style={styles.groupCount}>
          {retreatCount}{" "}
          {retreatCount === 1
            ? t("groups.retreatLabel") || "Retreat"
            : t("groups.retreatsLabel") || "Retreats"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Teaching Row ─────────────────────────────────────────────────────────────

/** Same line as the Latest list of Teachings & Talks: date, then session count. */
function teachingMeta(teaching: Gathering, language: string, t: GroupRowProps["t"]): string {
  const date = teaching.startDate
    ? new Date(teaching.startDate).toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const sessionCount = teaching.sessions?.length || 0;
  const sessionLabel =
    sessionCount === 1
      ? t("events.sessionLabel") || "session"
      : t("events.sessionsLabel") || "sessions";
  return date + (sessionCount > 0 ? ` · ${sessionCount} ${sessionLabel}` : "");
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function RetreatsListScreen() {
  const { isAuthenticated, user } = useAuth();
  const { openSignIn } = useSignIn();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useDesktopLayout();
  const [retreatData, setRetreatData] = useState<{
    retreat_groups: RetreatGroup[];
    recent_gatherings: Gathering[];
    total_stats: any;
  } | null>(() => retreatService.getUserRetreatsSync());
  // Show spinner only when there is no cached data to display yet.
  const [loading, setLoading] = useState(() => retreatService.getUserRetreatsSync() === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [teachings, setTeachings] = useState<Gathering[]>([]);
  // Rows from an older API carry no libraryAccess and stay under the personal heading.
  const grantedTeachings = teachings.filter((g) => g.libraryAccess !== "membership");
  const membershipTeachings = teachings.filter((g) => g.libraryAccess === "membership");
  // The empty state waits for /mine to settle, so it never flashes before teachings arrive.
  const [teachingsSettled, setTeachingsSettled] = useState(!isAuthenticated);

  // Teachings never block the groups list: any failure leaves the section out.
  const loadTeachings = async () => {
    try {
      const res = await teachingService.mine(user?.id);
      setTeachings(res.success ? res.data : []);
    } catch (err) {
      console.error("Error loading teachings:", err);
      setTeachings([]);
    } finally {
      setTeachingsSettled(true);
    }
  };

  const loadContent = async () => {
    try {
      // Only show the full-screen spinner when there is no data yet (lazy
      // initializer didn't find anything in the mirror).
      if (retreatData === null) setLoading(true);
      setError(null);
      setAuthRequired(false);
      const teachingsLoad = isAuthenticated ? loadTeachings() : Promise.resolve();
      const response = await retreatService.getUserRetreats();
      await teachingsLoad;
      if (response.success && response.data) {
        setRetreatData(response.data);
      } else if (response.authRequired) {
        setAuthRequired(true);
      } else {
        setError(response.error || "Failed to load retreats");
      }
    } catch (err) {
      console.error("Error loading retreats:", err);
      setError("Failed to load retreats");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await retreatService.getUserRetreats({ force: true });
    await loadContent();
    setRefreshing(false);
  };

  useEffect(() => {
    loadContent();
  }, [isAuthenticated]);

  const handleGroupPress = (group: RetreatGroup) => {
    const code = (group.abbreviation || group.id).toLowerCase();
    router.push(`/(tabs)/(groups)/retreats/${code}` as any);
  };

  const handleTeachingPress = (teaching: Gathering) => {
    router.push(`/(tabs)/(groups)/retreat/${teaching.id}` as any);
  };

  const handleAttendedPress = () => {
    const subject = t("retreats.attendedMailSubject") || "Access to my Personal Library";
    const body =
      t("retreats.attendedMailBody", { email: user?.email || "" }) ||
      `Hello,\n\nI would like access to the following:\n\n\nMy account email: ${user?.email || ""}\n`;
    Linking.openURL(
      `mailto:${INFO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    ).catch((err) => console.error("Could not open mail app:", err));
  };

  // Loading
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.burgundy[500]} />
          </View>
        </View>
      </>
    );
  }

  // Session expired — prompt sign-in
  if (authRequired) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.centerContent}>
            <Ionicons name="log-in-outline" size={40} color={colors.gray[400]} style={{ marginBottom: 12 }} />
            <Text style={styles.authTitle}>
              {t("auth.sessionExpiredTitle") || "Session expired"}
            </Text>
            <Text style={styles.authSubtitle}>
              {t("auth.sessionExpiredMessage") || "Sign in to access your retreats."}
            </Text>
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => openSignIn()}
            >
              <Text style={styles.signInButtonText}>
                {t("auth.signIn") || "Sign In"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  // Error (network / server)
  if (error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.centerContent}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.gray[400]} style={{ marginBottom: 12 }} />
            <Text style={styles.errorText}>
              {t("common.connectionError") || "Connection error"}
            </Text>
            <Text style={styles.errorSubtext}>
              {t("retreats.connectionErrorMessage") || "Please check your connection and try again."}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadContent}>
              <Text style={styles.retryButtonText}>
                {t("common.retry") || "Try Again"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  const groups = retreatData?.retreat_groups || [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={isDesktop ? styles.scrollContentDesktop : styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.burgundy[500]}
            />
          }
        >
          {/* Title with back button */}
          <View style={[styles.titleRow, isDesktop ? styles.desktopTitleRow : styles.indented]}>
            {!isDesktop && (
              <BackButton variant="inline" />
            )}
            <Text style={styles.pageTitle}>
              {t("home.retreats") || "Personal Library"}
            </Text>
          </View>

          {/* Red rule opens each list; thin dark lines separate the rows. */}
          {groups.length > 0 && (
            <View style={styles.retreatsSection}>
              <Text style={[styles.sectionTitle, !isDesktop && styles.indented]}>
                {t("retreats.retreatsSection") || "Your Retreats"}
              </Text>
              {!isDesktop && <SectionRule />}
              <View style={[isDesktop && styles.groupsListDesktop, !isDesktop && styles.ruleToInset]}>
                {groups.map((group) => (
                  <GroupRow
                    key={group.id}
                    group={group}
                    onPress={() => handleGroupPress(group)}
                    language={language}
                    t={t}
                    isDesktop={isDesktop}
                  />
                ))}
              </View>
            </View>
          )}

          {[
            { key: "granted", title: t("retreats.teachings") || "Your Teachings and Talks", items: grantedTeachings },
            {
              key: "membership",
              title: t("retreats.includedInMembership") || "Included in your membership",
              items: membershipTeachings,
            },
          ].map(
            (section) =>
              section.items.length > 0 && (
                <View key={section.key} style={styles.teachingsSection}>
                  <Text style={[styles.sectionTitle, !isDesktop && styles.indented]}>{section.title}</Text>
                  {!isDesktop && <SectionRule />}
                  <View style={isDesktop && styles.groupsListDesktop}>
                    {section.items.map((teaching) => (
                      <EventRow
                        key={teaching.id}
                        event={teaching}
                        title={getTranslatedName(teaching, language as "en" | "pt")}
                        meta={teachingMeta(teaching, language, t)}
                        onPress={() => handleTeachingPress(teaching)}
                        isDesktop={isDesktop}
                        titleFontSize={GROUP_NAME_FONT_SIZE}
                        testID={`teaching-card-${teaching.id}`}
                      />
                    ))}
                  </View>
                </View>
              ),
          )}

          {teachingsSettled && groups.length === 0 && teachings.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {t("retreats.emptyExplanation") ||
                  "This is where you'll find the recordings and texts reserved for you."}
              </Text>
              <TouchableOpacity {...getRowPressDelayProps()}
                style={styles.attendedCard}
                onPress={handleAttendedPress}
                testID="attended-retreat-card"
                accessibilityRole="link"
              >
                <Text style={styles.attendedTitle}>
                  {t("retreats.attendedTitle") || "Is something missing?"}
                </Text>
                <Text style={styles.attendedAction}>
                  {t("retreats.attendedAction") || "Write to us and we'll add it"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollView: {
    flex: 1,
  },
  // Mobile content runs edge to edge: text is indented per element so that
  // separators can start at the left screen edge.
  scrollContent: {
    paddingBottom: 120,
  },
  scrollContentDesktop: {
    paddingHorizontal: TEXT_GUTTER,
    paddingBottom: 120,
  },
  indented: {
    paddingHorizontal: TEXT_GUTTER,
  },
  // Lines start at the left edge and stop at the right inset.
  ruleToInset: {
    marginRight: RULE_RIGHT_INSET,
  },
  groupRowIndented: {
    paddingLeft: TEXT_GUTTER,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  desktopTitleRow: {
    paddingTop: 42,
  },

  // Title area
  pageTitle: {
    flex: 1,
    fontSize: 30,
    fontFamily: "MinionPro",
    color: colors.burgundy[500],
    fontVariant: ["small-caps"],
    letterSpacing: 0.5,
  },

  // Groups list
  groupsListDesktop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: SUBDIVISION_THICKNESS,
    borderBottomColor: SUBDIVISION_COLOR,
  },
  avatarContainer: {
    marginRight: 14,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: GROUP_NAME_FONT_SIZE,
    fontFamily: "EBGaramond_500Medium",
    color: colors.gray[800],
    marginBottom: 2,
  },
  groupCount: {
    fontSize: 13,
    color: colors.gray[500],
  },

  // Sections
  retreatsSection: {
    marginTop: 16,
  },
  teachingsSection: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "MinionPro",
    color: colors.burgundy[500],
    fontVariant: ["small-caps"],
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Empty / Error
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: TEXT_GUTTER,
  },
  attendedCard: {
    marginTop: 24,
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 2,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  attendedTitle: {
    fontSize: 17,
    fontFamily: "EBGaramond_500Medium",
    color: colors.gray[800],
    marginBottom: 4,
    textAlign: "center",
  },
  attendedAction: {
    fontSize: 15,
    color: colors.burgundy[500],
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    color: colors.gray[500],
    textAlign: "center",
  },
  authTitle: {
    fontSize: 20,
    fontFamily: "EBGaramond_500Medium",
    color: colors.gray[800],
    textAlign: "center",
    marginBottom: 6,
  },
  authSubtitle: {
    fontSize: 15,
    color: colors.gray[500],
    textAlign: "center",
    marginBottom: 20,
  },
  signInButton: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 2,
  },
  signInButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 17,
    fontFamily: "EBGaramond_500Medium",
    color: colors.gray[800],
    textAlign: "center",
    marginBottom: 6,
  },
  errorSubtext: {
    fontSize: 15,
    color: colors.gray[500],
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 2,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
});
