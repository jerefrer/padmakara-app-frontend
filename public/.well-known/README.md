# Passkey association files

Served from `https://app.padmakara.pt/.well-known/` (copied from `public/` by the Expo web export).

- `apple-app-site-association`: associates the iOS app (team `8A879BZ53C`, bundle `org.padmakara.pt`) with the domain for passkeys. Served without an extension.
- `assetlinks.json`: the Android statement. `sha256_cert_fingerprints` is empty on purpose. Before Android native passkeys work, add the SHA-256 fingerprints of both the EAS upload key and the Google Play app-signing key, and mirror the matching `android:apk-key-hash:...` origins in the API's `WEBAUTHN_ANDROID_ORIGINS`.
