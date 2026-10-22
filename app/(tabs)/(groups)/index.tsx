import { DraftBadge } from "@/components/DraftBadge";
import { NowPlayingBadge } from '@/components/NowPlayingBadge';
import { MembershipCard } from "@/components/membership/MembershipCard";
import { useAuth } from "@/contexts/AuthContext";
import { useSignIn } from '@/components/auth/SignInProvider';
import { useLanguage } from "@/contexts/LanguageContext";
import retreatService from "@/services/retreatService";
import { Gathering } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDesktopLayout } from "@/hooks/useDesktopLayout";
import { teacherFeedImageCacheKey } from "@/utils/cacheKeys";
import { AVENIR_FAMILY } from '@/constants/avenirFont';
import { EventRow, eventHasAudio } from '@/components/EventRow';
import { RULE_RIGHT_INSET, RULE_THICKNESS, TEXT_GUTTER } from '@/constants/layout';
import { firstScreenDrawn } from '@/utils/splashHandoff';

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
      <View style={styles.categoryText}>
        <Text style={styles.categoryTitle}>{title}</Text>
        <Text style={styles.categorySubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.categoryRule} />
    </TouchableOpacity>
  );
}

// ── Featured Event Card ──────────────────────────────────────────────────────

interface FeaturedEventProps {
  event: Gathering;
  onPress: () => void;
  language: string;
  isDesktop?: boolean;
  highlightLabel?: string;
  testID?: string;
}

function FeaturedEventCard({ event, onPress, language, isDesktop, highlightLabel, testID }: FeaturedEventProps) {
  const title =
    language === "pt" && event.name_translations?.pt
      ? event.name_translations.pt
      : event.name || event.name_translations?.en || "";

  const teacherNames =
    event.teachers?.[0]?.name || event.teachers?.[0]?.nameEn || "";

  const eventTypeName = event.eventType
    ? (language === "pt" && event.eventType.namePt
        ? event.eventType.namePt
        : event.eventType.nameEn)
    : null;

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

  const hasTranscripts =
    (event.transcripts && event.transcripts.length > 0) ||
    event.sessions?.some((s) =>
      s.tracks?.some((t) => !!t.transcript_file)
    );

  // Content-type indicators, same order as the event detail hero and the
  // desktop related-events list: video, audio, transcript.
  const hasVideo = (event.videos?.length ?? 0) > 0;
  const hasAudio = eventHasAudio(event);

  // Event type | date | organizer, empty parts skipped. The organizer is the
  // event's own; retreat groups name the practice course, not who put it on.
  const metaLine = [
    eventTypeName,
    event.startDate ? formatDate(event.startDate) : null,
    event.organizer?.trim() || null,
  ]
    .filter(Boolean)
    .join(" | ");

  const teacherImage = event.teachers?.[0]?.heroUrl || event.teachers?.[0]?.avatarUrl || event.teachers?.[0]?.photoUrl || null;
  // Anchored at the top so a teacher's head is never cut (André). The hero's vertical focal
  // point is tuned for the taller event-page banner and would push the frame down here.
  const teacherImagePosition = {
    left: `${event.teachers?.[0]?.heroUrl ? (event.teachers[0].heroFocalX ?? 50) : 50}%`,
    top: '0%',
  } as const;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.featuredCard, isDesktop && styles.featuredCardDesktop]}
      testID={testID}
    >
      <View style={[styles.featuredImageContainer, isDesktop && styles.featuredImageContainerDesktop]}>
        {teacherImage ? (
          <Image
            source={{ uri: teacherImage, cacheKey: teacherFeedImageCacheKey(event.teachers?.[0]) }}
            cachePolicy="memory-disk"
            transition={0}
            style={styles.featuredImage}
            contentFit="cover"
            contentPosition={teacherImagePosition}
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

      <View style={[styles.featuredInfo, isDesktop ? styles.featuredInfoDesktop : styles.featuredInfoMobile]}>
        {/* On desktop, the highlight label sits at top, info pushed to bottom */}
        {isDesktop && highlightLabel ? (
          <Text style={styles.highlightLabelInCard}>{highlightLabel}</Text>
        ) : null}

        {isDesktop && <View style={{ flex: 1 }} />}

        {teacherNames ? (
          <Text style={[styles.featuredTeacher, isDesktop && styles.featuredTeacherDesktop]}>
            {teacherNames}
          </Text>
        ) : null}
        <View style={styles.featuredTitleRow}>
          <Text style={[styles.featuredTitle, isDesktop && styles.featuredTitleDesktop]} numberOfLines={2}>
            {title}
          </Text>
          {event.status === 'draft' && <DraftBadge />}
        </View>
        <NowPlayingBadge eventId={event.id} />
        {metaLine ? (
          <Text style={styles.featuredMeta}>{metaLine}</Text>
        ) : null}

        <View style={styles.featuredIcons}>
          {hasVideo && (
            <Ionicons name="videocam-outline" size={18} color={colors.gray[500]} />
          )}
          {hasAudio && (
            <Ionicons name="musical-notes-outline" size={18} color={colors.gray[500]} />
          )}
          {hasTranscripts && (
            <Ionicons name="book-outline" size={18} color={colors.gray[500]} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Recent Event Card ────────────────────────────────────────────────────────

function RecentEventCard({
  event,
  onPress,
  language,
  isDesktop,
  testID,
}: FeaturedEventProps) {
  const title =
    language === "pt" && event.name_translations?.pt
      ? event.name_translations.pt
      : event.name || event.name_translations?.en || "";

  const eventTypeName = language === "pt" && event.eventType?.namePt
    ? event.eventType.namePt
    : event.eventType?.nameEn || "";

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

  const metaParts = [eventTypeName, event.startDate ? formatDate(event.startDate) : ""].filter(Boolean);

  return (
    <EventRow
      event={event}
      title={title}
      meta={metaParts.join("  |  ")}
      onPress={onPress}
      isDesktop={isDesktop}
      testID={testID}
    />
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { isAuthenticated, hasActiveSubscription, refreshUserData } = useAuth();
  const { openSignIn } = useSignIn();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useDesktopLayout();

  // Featured event — loaded for everyone (no auth needed).
  // Lazy initializer reads from the in-memory mirror so the first render
  // already has data when the cache is warm — no spinner flash.
  const [featuredEvent, setFeaturedEvent] = useState<Gathering | null>(() =>
    retreatService.getFeaturedEventSync()
  );
  const [featuredLoading, setFeaturedLoading] = useState(() =>
    retreatService.getFeaturedEventSync() === null
  );
  const [refreshing, setRefreshing] = useState(false);
  // Recently added events — also initialised from mirror.
  const [recentEvents, setRecentEvents] = useState<Gathering[]>(() => {
    const publicEvents = retreatService.getPublicEventsSync();
    if (!publicEvents) return [];
    const featuredId = retreatService.getFeaturedEventSync()?.id;
    return [...publicEvents]
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .filter((e) => e.id !== featuredId)
      .slice(0, 5);
  });

  const loadHomeData = async (isRefresh = false) => {
    // Show spinner only when there is nothing to display yet (mirror was cold
    // at mount time — lazy initializer returned null/empty).
    const showSpinner = featuredEvent === null && recentEvents.length === 0;
    if (showSpinner) setFeaturedLoading(true);

    try {
      const [featuredRes, publicRes] = await Promise.all([
        retreatService.getFeaturedEvent({ force: isRefresh }),
        retreatService.getPublicEvents({ force: isRefresh }),
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHomeData(true);
    setRefreshing(false);
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
    openSignIn({ returnTo: "/(tabs)/(groups)" });
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
    router.push("/(tabs)/(groups)/retreats");
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
      <View style={[styles.container, { paddingTop: insets.top }]} onLayout={firstScreenDrawn}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.burgundy[500]}
            />
          }
        >
          {/* App title — mobile only (desktop has sidebar) */}
          {!isDesktop && (
            <Text style={styles.appTitle}>PADMAKARA</Text>
          )}

          {/* Web only: invite signed-in non-members to the membership page.
              Native (reader app) never shows this. */}
          {Platform.OS === "web" && isAuthenticated && !hasActiveSubscription && (
            <View style={styles.membershipInvite}>
              <MembershipCard />
            </View>
          )}

          {/* Category navigation — mobile only (desktop has sidebar) */}
          {!isDesktop && (
            <>
              <CategoryRow
                title={t("home.teachingsAndTalks") || "Teachings & Talks"}
                subtitle={
                  t("home.teachingsSubtitle") ||
                  "Audio, videos and transcriptions"
                }
                onPress={handleTeachingsPress}
              />
              <CategoryRow
                title={t("home.retreats") || "Retreats"}
                subtitle={
                  t("home.retreatsSubtitle") ||
                  "Audio, videos and transcriptions (registration required)"
                }
                onPress={handleRetreatsPress}
              />
              <CategoryRow
                title={t("home.publications") || "Publications"}
                subtitle={
                  t("home.publicationsSubtitle") ||
                  "Padmakara Digital Editions"
                }
                onPress={handlePublicationsPress}
              />
            </>
          )}

          {/* Monthly highlight — shown for everyone */}
          {featuredLoading ? (
            <View style={styles.featuredLoadingContainer}>
              <ActivityIndicator size="small" color={colors.burgundy[500]} />
            </View>
          ) : featuredEvent ? (
            <View style={[styles.highlightSection, isDesktop && styles.highlightSectionDesktop]}>
              {/* On mobile, label is above the card. On desktop, it's inside the card. */}
              {!isDesktop && (
                <Text style={[styles.highlightLabel, styles.indented]}>
                  {t("home.monthlyHighlight") || "Our monthly highlight"}
                </Text>
              )}
              <FeaturedEventCard
                event={featuredEvent}
                language={language}
                onPress={handleFeaturedPress}
                isDesktop={isDesktop}
                highlightLabel={t("home.monthlyHighlight") || "Our monthly highlight"}
                testID={`event-card-${featuredEvent.id}`}
              />
            </View>
          ) : null}

          {/* Recently added */}
          {recentEvents.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={[styles.highlightLabel, !isDesktop && styles.indented]}>
                {t("home.recentlyAdded") || "Recently added"}
              </Text>
              <View style={[styles.recentDivider, !isDesktop && styles.ruleToGutter]} />
              {recentEvents.map((event) => (
                <RecentEventCard
                  key={event.id}
                  event={event}
                  language={language}
                  isDesktop={isDesktop}
                  testID={`event-card-${event.id}`}
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

          {/* Sign in prompt — mobile only (desktop has login in right sidebar) */}
          {!isAuthenticated && !isDesktop && (
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
    paddingHorizontal: 0,
    paddingTop: 24,
    paddingBottom: 120,
  },
  scrollContentDesktop: {
    paddingTop: 32,
    paddingHorizontal: TEXT_GUTTER,
  },
  indented: {
    paddingHorizontal: TEXT_GUTTER,
  },
  // A red rule that starts at the left edge and stops at the right inset.
  ruleToGutter: {
    marginRight: RULE_RIGHT_INSET,
  },
  membershipInvite: {
    marginBottom: 20,
    marginHorizontal: TEXT_GUTTER,
  },

  // App title (mobile)
  appTitle: {
    fontFamily: "EBGaramond_500Medium",
    fontSize: 20,
    color: colors.burgundy[500],
    textAlign: "center",
    letterSpacing: 2.5,
    marginBottom: 12,
  },

  // Category rows
  categoryRow: {
    paddingTop: 12,
  },
  categoryText: {
    paddingHorizontal: TEXT_GUTTER,
    paddingBottom: 6,
  },
  categoryRule: {
    height: RULE_THICKNESS,
    marginRight: RULE_RIGHT_INSET,
    backgroundColor: colors.burgundy[500],
  },
  categoryTitle: {
    fontSize: 26,
    fontFamily: "MinionPro",
    color: colors.gray[800],
    fontVariant: ["small-caps"],
    letterSpacing: -0.2,
    marginBottom: 0,
  },
  categorySubtitle: {
    fontSize: 13,
    fontFamily: AVENIR_FAMILY,
    color: colors.gray[500],
    letterSpacing: -0.1,
  },

  // Monthly highlight
  highlightSection: {
    marginTop: 4,
  },
  highlightSectionDesktop: {
    marginTop: 0,
  },
  highlightLabel: {
    fontSize: 28,
    fontFamily: "EBGaramond_400Regular_Italic",
    color: colors.burgundy[500],
    marginBottom: 6,
  },
  highlightLabelInCard: {
    fontSize: 28,
    fontFamily: "EBGaramond_400Regular_Italic",
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
  featuredCardDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 24,
  },
  featuredImageContainer: {
    width: "100%",
    aspectRatio: 16 / 10,
    backgroundColor: "#f0f0f0",
    overflow: "hidden",
  },
  featuredImageContainerDesktop: {
    borderRadius: 4,
    width: "45%",
    aspectRatio: undefined,
    minHeight: 280,
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
    paddingTop: 4,
    paddingBottom: 8,
  },
  featuredInfoMobile: {
    paddingHorizontal: TEXT_GUTTER,
  },
  featuredInfoDesktop: {
    flex: 1,
    paddingTop: 0,
  },
  featuredTeacher: {
    fontSize: 31,
    fontFamily: "EBGaramond_500Medium",
    color: colors.burgundy[500],
    marginBottom: 2,
  },
  featuredTeacherDesktop: {
    fontSize: 30,
    marginBottom: 4,
  },
  featuredTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flexWrap: 'wrap' as const,
    marginBottom: 4,
  },
  featuredTitle: {
    fontSize: 20,
    fontFamily: "EBGaramond_400Regular",
    color: colors.gray[800],
    flex: 1,
  },
  featuredTitleDesktop: {
    fontSize: 20,
    marginBottom: 8,
  },
  featuredMeta: {
    fontSize: 12,
    fontFamily: AVENIR_FAMILY,
    color: colors.gray[500],
    letterSpacing: 0.2,
  },
  featuredIcons: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: 10,
    gap: 12,
  },

  // Recently added section
  recentSection: {
    marginTop: 28,
  },
  recentDivider: {
    height: RULE_THICKNESS,
    backgroundColor: colors.burgundy[500],
    marginBottom: 4,
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
