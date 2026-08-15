import type { ExpoConfig } from "expo/config";

/**
 * Per-country app variants.
 *
 * Padmakara ships as one app per association, built from this single codebase.
 * Which variant is built is selected by the APP_VARIANT environment variable
 * (see the `env` block of each build profile in eas.json). Defaults to "pt".
 *
 * Bundle identifiers and URL schemes are permanent once an app is publicly
 * released — they can never be renamed afterwards. Do not change the values
 * below for a variant that has already shipped.
 */

type VariantConfig = {
  /** Display name under the icon and in the App Store. */
  name: string;
  /** Expo project slug. Must match the project's slug on expo.dev. */
  slug: string;
  /** Custom URL scheme. No hyphens: this carries the magic-link auth flow. */
  scheme: string;
  /** iOS bundle identifier and Android package name (kept identical). */
  applicationId: string;
  /** Expo account or organisation that owns the EAS project. */
  owner: string | null;
  /** EAS project id, from expo.dev. */
  easProjectId: string | null;
  /** Deep link prefixes accepted by the app. */
  linkingPrefixes: string[];
  /** Sentry upload target, or null to disable source map upload. */
  sentry: { organization: string; project: string } | null;
  /** Sentry DSN read at runtime via Constants.expoConfig.extra.sentryDsn. */
  sentryDsn: string | null;
};

const VARIANTS: Record<string, VariantConfig> = {
  pt: {
    name: "Padmakara",
    slug: "padmakara-pt",
    scheme: "padmakarapt",
    applicationId: "org.padmakara.pt",
    owner: "padmakara-portugal",
    easProjectId: "615afabe-bd92-4092-9c47-b1765d92e7e3",
    linkingPrefixes: [
      "padmakarapt://",
      "https://padmakara.app",
      "https://app.padmakara.pt",
    ],
    sentry: { organization: "padmakarapt", project: "react-native" },
    sentryDsn:
      "https://a0c5633e88bc9febe3d131bd356303e6@o4510993302618112.ingest.de.sentry.io/4510993304256592",
  },

  // Padmakara France launches several months after Portugal. The identifiers
  // below are reserved by convention only — nothing is registered with Apple
  // or Google yet, and `org.padmakara.fr` must NOT be claimed under Portugal's
  // developer account, because bundle ids are globally unique and France may
  // enroll its own account.
  //
  // Building this variant fails loudly until the null fields are filled in.
  fr: {
    name: "Padmakara France",
    slug: "padmakara-fr",
    scheme: "padmakarafr",
    applicationId: "org.padmakara.fr",
    owner: null,
    easProjectId: null,
    linkingPrefixes: ["padmakarafr://"],
    sentry: null,
    sentryDsn: null,
  },
};

/** Fields that must be set before a variant can be built at all. */
const REQUIRED_FIELDS = ["owner", "easProjectId"] as const;

function resolveVariant(): VariantConfig {
  const key = process.env.APP_VARIANT ?? "pt";
  const variant = VARIANTS[key];

  if (!variant) {
    throw new Error(
      `Unknown APP_VARIANT "${key}". Expected one of: ${Object.keys(VARIANTS).join(", ")}.`,
    );
  }

  const missing = REQUIRED_FIELDS.filter((field) => variant[field] === null);
  if (missing.length > 0) {
    throw new Error(
      `The "${key}" variant is not ready to build yet. ` +
        `Set these fields in app.config.ts first: ${missing.join(", ")}. ` +
        `They come from the EAS project on expo.dev, which must be created before the first build.`,
    );
  }

  return variant;
}

const variant = resolveVariant();

// `linking` is not part of Expo's published config schema and nothing in the
// app currently reads it — expo-router derives deep links from `scheme`. It is
// carried over from app.json unchanged so this change alters nothing beyond the
// identifiers; removing it is a separate cleanup.
type PadmakaraConfig = ExpoConfig & {
  linking?: {
    prefixes: string[];
    config: { screens: Record<string, unknown> };
  };
};

const config: PadmakaraConfig = {
  name: variant.name,
  slug: variant.slug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: variant.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  owner: variant.owner ?? undefined,
  linking: {
    prefixes: variant.linkingPrefixes,
    config: {
      screens: {
        "(auth)": {
          screens: {
            "magic-link": "magic-link",
            "check-email": "check-email",
          },
        },
        "(tabs)": {
          screens: {
            index: "",
            profile: "profile",
          },
        },
      },
    },
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: variant.applicationId,
    icon: "./assets/images/iOS.icon",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ["audio"],
    },
  },
  android: {
    package: variant.applicationId,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      monochromeImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#C4423E",
    },
    edgeToEdgeEnabled: true,
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
    name: variant.name,
  },
  plugins: [
    "expo-audio",
    "expo-router",
    [
      "expo-splash-screen",
      {
        // Full brand lockup (dharma wheel + "PADMAKARA" / "RAMO LUSÓFONO"),
        // white on the brand burgundy. The wordmark is baked into the image
        // because expo-splash-screen only renders a single centered image; it
        // is a fixed logo, not translatable UI copy. When the FR variant ships
        // it will need its own lockup image (mirroring the per-variant `name`).
        image: "./assets/images/splash.png",
        imageWidth: 260,
        resizeMode: "contain",
        backgroundColor: "#9b1b1b",
      },
    ],
    ...(variant.sentry
      ? [["@sentry/react-native/expo", variant.sentry] as [string, object]]
      : []),
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
      },
    ],
    "expo-secure-store",
  ],
  extra: {
    sentryDsn: variant.sentryDsn ?? "",
    router: {},
    eas: {
      projectId: variant.easProjectId,
    },
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
