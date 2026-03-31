import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import retreatService from "@/services/retreatService";
import { Gathering } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const colors = {
  burgundy: {
    500: "#9b1b1b",
    600: "#7b1616",
    700: "#5a1111",
  },
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

// ── Category Row ─────────────────────────────────────────────────────────────

interface CategoryRowProps {
  title: string;
  subtitle: string;
  onPress: () => void;
}

function CategoryRow({ title, subtitle, onPress }: CategoryRowProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.categoryRow}>
      <Text style={styles.categoryTitle}>{title}</Text>
      <Text style={styles.categorySubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

// ── Featured Event Card ──────────────────────────────────────────────────────

interface FeaturedEventProps {
  event: Gathering;
  onPress: () => void;
  language: string;
}

function FeaturedEventCard({ event, onPress, language }: FeaturedEventProps) {
  const title =
    language === "pt" && event.name_translations?.pt
      ? event.name_translations.pt
      : event.name || event.name_translations?.en || "";

  const teacherNames =
    event.teachers?.map((t: any) => t.name || t.nameEn || "").join(", ") || "";

  const sessionCount = event.sessions?.length || 0;

  const formatDate = (dateStr: string) => {
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
  };

  const teacherImage = event.teachers?.[0]?.avatarUrl || event.teachers?.[0]?.photoUrl || null;

  return (
    <TouchableOpacity onPress={onPress} style={styles.featuredCard}>
      <View style={styles.featuredImageContainer}>
        {teacherImage ? (
          <Image
            source={{ uri: teacherImage }}
            cacheKey={event.teachers?.[0]?.avatarUpdatedAt ? `teacher-avatar-${event.teachers[0].abbreviation}-${event.teachers[0].avatarUpdatedAt}` : undefined}
            style={styles.featuredImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.featuredImagePlaceholder}>
            <Ionicons
              name="musical-notes-outline"
              size={48}
              color={colors.gray[400]}
            />
          </View>
        )}
      </View>

      <View style={styles.featuredInfo}>
        {teacherNames ? (
          <Text style={styles.featuredTeacher}>{teacherNames}</Text>
        ) : null}
        <Text style={styles.featuredTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.featuredMeta}>
          {event.startDate ? formatDate(event.startDate) : ""}
          {sessionCount > 0 ? ` · ${sessionCount} sessions` : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Recent Event Card ────────────────────────────────────────────────────────

function RecentEventCard({
  event,
  onPress,
  language,
}: FeaturedEventProps) {
  const title =
    language === "pt" && event.name_translations?.pt
      ? event.name_translations.pt
      : event.name || event.name_translations?.en || "";

  const teacherNames =
    event.teachers?.map((t: any) => t.name || t.nameEn || "").join(", ") || "";

  const teacherImage = event.teachers?.[0]?.avatarUrl || event.teachers?.[0]?.photoUrl || null;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.recentCard}>
      <View style={styles.recentImageContainer}>
        {teacherImage ? (
          <Image
            source={{ uri: teacherImage }}
            cacheKey={event.teachers?.[0]?.avatarUpdatedAt ? `teacher-avatar-${event.teachers[0].abbreviation}-${event.teachers[0].avatarUpdatedAt}` : undefined}
            style={styles.recentImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.recentImagePlaceholder}>
            <Ionicons
              name="musical-notes-outline"
              size={28}
              color={colors.gray[400]}
            />
          </View>
        )}
      </View>
      <View style={styles.recentInfo}>
        <Text style={styles.recentTitle} numberOfLines={2}>
          {title}
        </Text>
        {teacherNames ? (
          <Text style={styles.recentTeacher} numberOfLines={1}>
            {teacherNames}
          </Text>
        ) : null}
        <Text style={styles.recentMeta} numberOfLines={1}>
          {event.startDate ? formatDate(event.startDate) : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { isAuthenticated, refreshUserData } = useAuth();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();

  // Featured event — loaded for everyone (no auth needed)
  const [featuredEvent, setFeaturedEvent] = useState<Gathering | null>(null);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  // Recently added events
  const [recentEvents, setRecentEvents] = useState<Gathering[]>([]);

  const loadHomeData = async () => {
    try {
      setFeaturedLoading(true);
      const [featuredRes, publicRes] = await Promise.all([
        retreatService.getFeaturedEvent(),
        retreatService.getPublicEvents(),
      ]);
      if (featuredRes.success && featuredRes.data) {
        setFeaturedEvent(featuredRes.data);
      }
      if (publicRes.success && publicRes.data) {
        // Sort by start date descending, exclude featured, take top 5
        const featuredId = featuredRes.data?.id;
        const sorted = [...publicRes.data]
          .sort(
            (a, b) =>
              new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          )
          .filter((e) => e.id !== featuredId)
          .slice(0, 5);
        setRecentEvents(sorted);
      }
    } catch (err) {
      console.error("Error loading home data:", err);
    } finally {
      setFeaturedLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refreshUserData();
      }
    }, [isAuthenticated]),
  );

  const handleSignInPress = () => {
    router.push({
      pathname: "/(auth)/magic-link",
      params: { returnTo: "/(tabs)/(groups)" },
    });
  };

  const handleTeachingsPress = () => {
    // Public events — navigate within (groups) stack so the home tab stays active
    router.push("/(tabs)/(groups)/events");
  };

  const handleRetreatsPress = () => {
    if (!isAuthenticated) {
      handleSignInPress();
      return;
    }
    router.push("/(tabs)/(groups)/retreats-list");
  };

  const handlePublicationsPress = () => {
    router.push("/(tabs)/(groups)/publications");
  };

  const handleFeaturedPress = () => {
    if (featuredEvent) {
      router.push({
        pathname: "/(tabs)/(groups)/retreat/[id]",
        params: { id: String(featuredEvent.id), from: "events" },
      } as any);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Category navigation */}
          <CategoryRow
            title={t("home.teachingsAndTalks") || "Teachings & Talks"}
            subtitle={
              t("home.teachingsSubtitle") ||
              "Events by Kangyur Rinpoche Found., Songtsen Pt & others"
            }
            onPress={handleTeachingsPress}
          />
          <CategoryRow
            title={t("home.retreats") || "Retreats"}
            subtitle={
              t("home.retreatsSubtitle") ||
              "Organized by Kangyur Rinpoche Foundation"
            }
            onPress={handleRetreatsPress}
          />
          <CategoryRow
            title={t("home.publications") || "Publications"}
            subtitle={
              t("home.publicationsSubtitle") ||
              "By Padmakara in Portuguese Language"
            }
            onPress={handlePublicationsPress}
          />

          {/* Monthly highlight — shown for everyone */}
          {featuredLoading ? (
            <View style={styles.featuredLoadingContainer}>
              <ActivityIndicator size="small" color={colors.burgundy[500]} />
            </View>
          ) : featuredEvent ? (
            <View style={styles.highlightSection}>
              <Text style={styles.highlightLabel}>
                {t("home.monthlyHighlight") || "Our monthly highlight"}
              </Text>
              <FeaturedEventCard
                event={featuredEvent}
                language={language}
                onPress={handleFeaturedPress}
              />
            </View>
          ) : null}

          {/* Recently added */}
          {recentEvents.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.highlightLabel}>
                {t("home.recentlyAdded") || "Recently added"}
              </Text>
              {recentEvents.map((event) => (
                <RecentEventCard
                  key={event.id}
                  event={event}
                  language={language}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/(groups)/retreat/[id]",
                      params: { id: String(event.id), from: "events" },
                    } as any)
                  }
                />
              ))}
            </View>
          )}

          {/* Sign in prompt — shown subtly at the bottom when not authenticated */}
          {!isAuthenticated && (
            <View style={styles.signInSection}>
              <Text style={styles.signInText}>
                {t("groups.signInPrompt") ||
                  "Sign in to access retreat recordings and transcripts."}
              </Text>
              <TouchableOpacity
                style={styles.signInButton}
                onPress={handleSignInPress}
              >
                <Text style={styles.signInButtonText}>
                  {t("groups.signIn") || "Sign In"}
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120,
  },

  // Category rows
  categoryRow: {
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  categoryTitle: {
    fontSize: 26,
    fontFamily: "EBGaramond_600SemiBold",
    color: colors.gray[800],
    fontVariant: ["small-caps"],
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 14,
    color: colors.gray[500],
    fontVariant: ["small-caps"],
    letterSpacing: 0.3,
  },

  // Monthly highlight
  highlightSection: {
    marginTop: 28,
  },
  highlightLabel: {
    fontSize: 22,
    fontFamily: "EBGaramond_600SemiBold",
    fontStyle: "italic",
    color: colors.burgundy[500],
    marginBottom: 16,
  },
  featuredLoadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },

  // Featured event card
  featuredCard: {
    overflow: "hidden",
  },
  featuredImageContainer: {
    width: "100%",
    aspectRatio: 16 / 10,
    backgroundColor: "#f0f0f0",
    overflow: "hidden",
  },
  featuredImage: {
    width: "100%",
    height: "100%",
  },
  featuredImagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  featuredInfo: {
    paddingTop: 14,
    paddingBottom: 8,
  },
  featuredTeacher: {
    fontSize: 20,
    fontFamily: "EBGaramond_600SemiBold",
    color: colors.burgundy[500],
    marginBottom: 2,
  },
  featuredTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.gray[800],
    marginBottom: 4,
  },
  featuredMeta: {
    fontSize: 13,
    color: colors.gray[500],
  },

  // Recently added section
  recentSection: {
    marginTop: 28,
  },
  recentCard: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  recentImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
    marginRight: 14,
  },
  recentImage: {
    width: "100%",
    height: "100%",
  },
  recentImagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  recentInfo: {
    flex: 1,
    justifyContent: "center",
  },
  recentTitle: {
    fontSize: 18,
    fontFamily: "EBGaramond_600SemiBold",
    color: colors.burgundy[500],
    marginBottom: 2,
  },
  recentTeacher: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[800],
    marginBottom: 2,
  },
  recentMeta: {
    fontSize: 13,
    color: colors.gray[500],
  },

  // Sign in section — subtle, at the bottom
  signInSection: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  signInText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray[500],
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 2,
  },
  signInButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
