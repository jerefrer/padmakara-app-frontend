# Association files

Served from `https://app.padmakara.pt/.well-known/` (copied from `public/` by the Expo web export).

- `apple-app-site-association` (served without an extension), for the iOS app (team `8A879BZ53C`, bundle `org.padmakara.pt`):
  - `webcredentials`: passkeys.
  - `applinks`: the paths that open the installed app instead of Safari. They must match `APP_LINK_PATHS` in `app.config.ts`; `__tests__/appLinks.test.ts` checks it. Sign-in pages and purchase pages (`/get`, `/membership`) are left out on purpose.
- `assetlinks.json`, the Android statements:
  - `handle_all_urls`: lets the app open app.padmakara.pt links (the intent filter in `app.config.ts`). It lists the SHA-256 of the Google Play app-signing certificate, which signs every install from Play. A build sideloaded with the EAS upload key would need that key's fingerprint added too.
  - `get_login_creds`: passkeys. `sha256_cert_fingerprints` is empty on purpose. Before Android native passkeys work, add the SHA-256 fingerprints of both the EAS upload key and the Google Play app-signing key, and mirror the matching `android:apk-key-hash:...` origins in the API's `WEBAUTHN_ANDROID_ORIGINS`.
