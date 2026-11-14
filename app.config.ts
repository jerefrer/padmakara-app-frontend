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
  /** iOS associated domains, only for variants whose bundle id is listed in the AASA file. */
  associatedDomains: string[] | null;
  /** Whether app.padmakara.pt links open this variant's Android app (assetlinks.json lists it). */
  androidAppLinks: boolean;
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
    // The AASA file on app.padmakara.pt lists org.padmakara.pt only: passkeys
    // (webcredentials) and links that open the app (applinks, see APP_LINK_PATHS).
    associatedDomains: ["webcredentials:app.padmakara.pt", "applinks:app.padmakara.pt"],
    androidAppLinks: true,
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
    associatedDomains: null,
    androidAppLinks: false,
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

/**
 * Paths of app.padmakara.pt that open the installed app (iOS universal links,
 * Android app links) instead of the browser: "/" exactly, every other entry as
 * itself and anything under it. Sign-in pages (/magic-link, /check-email,
 * /device-activated…) and purchase pages (/get, /membership) are left out on
 * purpose: a sign-in link must finish where it was asked for, and payment
 * never happens inside the app. public/.well-known/apple-app-site-association
 * lists the same paths (checked by __tests__/appLinks.test.ts).
 */
export const APP_LINK_PATHS = [
  "/",
  "/events",
  "/publications",
  "/retreat",
  "/retreats",
  "/teacher",
  "/transcript",
  "/account",
  "/bookmarks",
  "/search",
  "/settings",
] as const;

const APP_LINK_HOST = "app.padmakara.pt";

type AppLinkData = { scheme: string; host: string; path?: string; pathPrefix?: string };

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
  // The window behind the app (expo-system-ui). Unset, iOS paints it black in dark mode, and
  // it showed for a few frames between the splash and the home.
  backgroundColor: "#ffffff",
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
    // Passkeys: ties the app to the web domain (see public/.well-known).
    ...(variant.associatedDomains ? { associatedDomains: variant.associatedDomains } : {}),
    icon: "./assets/images/iOS.icon",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ["audio"],
    },
  },
  android: {
    package: variant.applicationId,
    adaptiveIcon: {
      // The wheel at 56% of the canvas: launchers mask adaptive icons and only the
      // centre 66% is guaranteed visible, so the full-bleed adaptive-icon.png lost its
      // outer circles and looked oversized next to the iOS icon.
      foregroundImage: "./assets/images/adaptive-icon-foreground.png",
      monochromeImage: "./assets/images/adaptive-icon-foreground.png",
      backgroundColor: "#C4423E",
    },
    // Android 13+ blocks all notifications, including the lock-screen media
    // player expo-audio posts, unless the app declares this. Requested at runtime
    // on first play (services/notificationPermission.ts).
    permissions: ["android.permission.POST_NOTIFICATIONS"],
    // Links to app.padmakara.pt open the app, verified by public/.well-known/assetlinks.json.
    ...(variant.androidAppLinks
      ? {
          intentFilters: [
            {
              action: "VIEW",
              autoVerify: true,
              category: ["BROWSABLE", "DEFAULT"],
              // Each path itself and anything under it, like the AASA components:
              // a bare prefix would also catch /account-deletion.
              data: APP_LINK_PATHS.flatMap((path): AppLinkData[] =>
                path === "/"
                  ? [{ scheme: "https", host: APP_LINK_HOST, path }]
                  : [
                      { scheme: "https", host: APP_LINK_HOST, path },
                      { scheme: "https", host: APP_LINK_HOST, pathPrefix: `${path}/` },
                    ],
              ),
            },
          ],
        }
      : {}),
    // The UI is light-only. Forcing the light theme on Android makes the system
    // navigation bar buttons dark (they follow the theme under edge-to-edge),
    // so they stay readable on the white tab bar when the phone is in dark mode.
    userInterfaceStyle: "light",
    // Permissions pulled in by Expo libraries that the app never uses (it only
    // plays audio, and stores files in app-private directories). Play reviewers
    // flag them. USE_BIOMETRIC stays; FOREGROUND_SERVICE(_MEDIA_PLAYBACK) stays
    // for the lock-screen player.
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.USE_FINGERPRINT",
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
    name: variant.name,
  },
  plugins: [
    [
      "expo-audio",
      // Playback only: no microphone usage string on iOS, no RECORD_AUDIO on Android.
      { microphonePermission: false, recordAudioAndroid: false },
    ],
    "./plugins/withMediaNotificationIcon",
    // Portrait at launch and everywhere by default; see plugins/withPhoneLandscape.js.
    ["expo-screen-orientation", { initialOrientation: "PORTRAIT_UP" }],
    "./plugins/withPhoneLandscape",
    [
      "expo-router",
      // SDK 58 turns async (lazy) routes on for web. The static export stays eager until the
      // sign-in page has been checked with them.
      { asyncRoutes: { web: false } },
    ],
    [
      "expo-splash-screen",
      {
        // Full brand lockup (dharma wheel + "PADMAKARA" / "RAMO LUSÓFONO"),
        // white on the app burgundy. The wheel and wordmark come from André's
        // "Logo PADMAKARA BRANCO 2026.eps"; "RAMO LUSÓFONO" is set in Minion Pro
        // under it, as on his mockup. The wordmark is baked into the image
        // because expo-splash-screen only renders a single centered image; it
        // is a fixed logo, not translatable UI copy. When the FR variant ships
        // it will need its own lockup image (mirroring the per-variant `name`).
        image: "./assets/images/splash.png",
        imageWidth: 290,
        resizeMode: "contain",
        // The app's burgundy, so the launch screen matches everything after it;
        // AppLockScreen uses the same.
        backgroundColor: "#9b1b1b",
        // Android 12+ masks the splash icon to a circle (160 dp visible of a 240 dp
        // canvas), which cropped the lockup to the wheel plus a sliver of the
        // wordmark. Android gets the wheel alone: splash-android.png is a 1600 px
        // transparent square with the wheel at 59% of its width, so it sits inside
        // the circular safe zone (66%). imageWidth 240 = the icon canvas in dp.
        android: {
          image: "./assets/images/splash-android.png",
          imageWidth: 240,
        },
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
    [
      "expo-local-authentication",
      {
        faceIDPermission:
          "Padmakara uses Face ID to unlock the app when you choose to lock it.",
      },
    ],
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
