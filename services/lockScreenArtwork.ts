import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

/**
 * Fallback artwork for the lock screen, Apple Watch, CarPlay and Android Auto, used when a
 * track has no speaker photo (`track.speakerArtworkUrl`, a square crop served by the API).
 *
 * iOS: the bundled app icon (1024 x 1024), shown as a small square thumbnail. It
 * resolves to a local file after `downloadAsync`, so it also shows offline; in a dev
 * build it is a Metro http URL, which works while the dev server is reachable.
 *
 * Android: a plain square in the app's burgundy, served by the web app (public/).
 * Android 13+ draws the artwork as the full background of the media card and takes the
 * card's colours from it, so a logo there sits under the text, while a plain square
 * gives a red card. It cannot be the bundled icon anyway: in a release build that
 * resolves to a drawable name, not a URL, which expo-audio rejects. The app is named
 * on the card by its small icon (plugins/withMediaNotificationIcon.js).
 */
const ARTWORK_MODULE = require('@/assets/images/icon.png');

const ANDROID_ARTWORK_URL = 'https://app.padmakara.pt/lockscreen-artwork.png';

let pending: Promise<string | null> | null = null;

export function getLockScreenArtworkUri(): Promise<string | null> {
  if (Platform.OS === 'android') return Promise.resolve(ANDROID_ARTWORK_URL);
  if (!pending) {
    pending = (async () => {
      try {
        const asset = Asset.fromModule(ARTWORK_MODULE);
        if (!asset.localUri) await asset.downloadAsync();
        return asset.localUri ?? asset.uri ?? null;
      } catch (error) {
        console.warn('Lock screen artwork unavailable:', error);
        return null;
      }
    })();
  }
  return pending;
}

/** Test hook: forget the memoised result. */
export function __resetLockScreenArtwork(): void {
  pending = null;
}
