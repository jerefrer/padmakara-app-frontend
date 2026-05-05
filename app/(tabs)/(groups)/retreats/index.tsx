import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import retreatService from "@/services/retreatService";
import { Gathering, RetreatGroup } from "@/types";
import { getTranslatedName } from "@/utils/i18n";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDesktopLayout } from "@/hooks/useDesktopLayout";

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
}

function GroupRow({ group, onPress, language, t }: GroupRowProps) {
  const retreatCount = group.gatherings?.length || 0;
  const groupName = getTranslatedName(group, language as "en" | "pt");
  const groupImage = getGroupImage(groupName);

  return (
    <TouchableOpacity onPress={onPress} style={styles.groupRow}>
      {/* Round avatar */}
      <View style={styles.avatarContainer}>
        {groupImage ? (
          <Image
            source={groupImage}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="leaf-outline" size={20} color={colors.gray[400]} />
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

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function RetreatsListScreen() {
  const { isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useDesktopLayout();
  const [retreatData, setRetreatData] = useState<{
    retreat_groups: RetreatGroup[];
    recent_gatherings: Gathering[];
    total_stats: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const loadContent = async () => {
    try {
      setLoading(true);
      setError(null);
      setAuthRequired(false);
      const response = await retreatService.getUserRetreats();
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

  useEffect(() => {
    loadContent();
  }, [isAuthenticated]);

  const handleGroupPress = (group: RetreatGroup) => {
    const code = (group.abbreviation || group.id).toLowerCase();
    router.push(`/(tabs)/(groups)/retreats/${code}` as any);
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
              onPress={() => router.push("/(auth)/magic-link")}
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

  // Get teachers from all gatherings for the subtitle
  const allTeachers = new Set<string>();
  for (const group of groups) {
    for (const gathering of group.gatherings || []) {
      for (const teacher of gathering.teachers || []) {
        const name = teacher.name || (teacher as any).nameEn || "";
        if (name) allTeachers.add(name);
      }
    }
  }
  const teachersList = Array.from(allTeachers).slice(0, 3).join(", ");
  const orgInfo = "Org. Kangyur Rinpoche Foundation, Portugal";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Title with back button */}
          <View style={[styles.titleRow, isDesktop && styles.desktopTitleRow]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={22} color={colors.gray[800]} />
            </TouchableOpacity>
            <Text style={styles.pageTitle}>
              {t("home.retreats") || "Retreats"}
            </Text>
          </View>

          {/* Subtitle info */}
          {teachersList ? (
            <Text style={styles.pageSubtitle}>{teachersList}</Text>
          ) : null}
          <Text style={styles.pageOrg}>{orgInfo}</Text>

          {/* Groups list */}
          <View style={styles.groupsList}>
            {groups.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                onPress={() => handleGroupPress(group)}
                language={language}
                t={t}
              />
            ))}
          </View>

          {groups.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {t("groups.noGroupsDescription") ||
                  "No retreat groups available."}
              </Text>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
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
    paddingTop: 32,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -8,
    marginRight: 4,
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
  pageSubtitle: {
    fontSize: 15,
    color: colors.gray[700],
    marginBottom: 2,
  },
  pageOrg: {
    fontSize: 13,
    color: colors.gray[500],
    marginBottom: 24,
  },

  // Groups list
  groupsList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  avatarContainer: {
    marginRight: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontSize: 17,
    fontFamily: "EBGaramond_500Medium",
    color: colors.gray[800],
    marginBottom: 2,
  },
  groupCount: {
    fontSize: 13,
    color: colors.gray[500],
  },

  // Empty / Error
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
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
