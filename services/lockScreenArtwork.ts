import { Asset } from 'expo-asset';

/**
 * Artwork shown on the lock screen, Apple Watch, CarPlay and Android Auto.
 *
 * Decision: the bundled app icon, not the event hero. The track and the
 * playback meta carry no image fields, and the heroes live in expo-image's
 * cache under opaque keys, so they cannot be handed to the native players
 * (expo-audio fetches the artwork URL itself). The bundled icon always
 * resolves to a local file after `downloadAsync`, so it also shows offline;
 * both native loaders (URLSession on iOS, URL.openConnection on Android)
 * accept file:// URLs. In a dev build the asset is a Metro http URL, which
 * works while the dev server is reachable.
 */
const ARTWORK_MODULE = require('@/assets/images/icon.png');

let pending: Promise<string | null> | null = null;

export function getLockScreenArtworkUri(): Promise<string | null> {
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
