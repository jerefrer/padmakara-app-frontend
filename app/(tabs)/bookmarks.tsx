import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDesktopLayout } from "@/hooks/useDesktopLayout";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const colors = {
  burgundy: { 500: "#9b1b1b" },
  gray: { 400: "#9ca3af", 500: "#6b7280", 600: "#4b5563", 800: "#2c2c2c" },
};

export default function BookmarksScreen() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { isDesktop } = useDesktopLayout();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>
          {t("navigation.bookmarks") || "Bookmarks"}
        </Text>

        <View style={styles.emptyState}>
          <Ionicons
            name="bookmark-outline"
            size={48}
            color={colors.gray[400]}
          />
          <Text style={styles.emptyTitle}>
            {t("player.bookmarks") || "Bookmarks"}
          </Text>
          <Text style={styles.emptyText}>
            {isAuthenticated
              ? "Your bookmarked tracks will appear here."
              : "Sign in to save bookmarks."}
          </Text>
        </View>
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
    fontFamily: "EBGaramond_600SemiBold",
    color: colors.burgundy[500],
    marginBottom: 32,
    fontVariant: ["small-caps"],
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
});
