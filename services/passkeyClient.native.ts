import { NativeModules, Platform } from 'react-native';
import { Passkey } from 'react-native-passkey';
import type { PasskeyCreateRequest, PasskeyGetRequest } from 'react-native-passkey';
import type { PasskeyClient } from './passkeyClient.types';

// Android stays off until the Digital Asset Links file for org.padmakara.pt is published
// on app.padmakara.pt; without it every Android request fails with a configuration error.
const NATIVE_PLATFORMS_ENABLED = ['ios'];

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const code = (error as { error?: unknown }).error;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

const passkeyClient: PasskeyClient = {
  async isSupported() {
    // Expo Go and dev clients built before the library was added have no native module.
    if (!NativeModules.Passkey) return false;
    return NATIVE_PLATFORMS_ENABLED.includes(Platform.OS) && Passkey.isSupported();
  },

  async supportsAutofill() {
    return false;
  },

  async create(options) {
    const result = await Passkey.create(options as unknown as PasskeyCreateRequest);
    return {
      id: result.id,
      rawId: result.rawId,
      type: 'public-key',
      authenticatorAttachment: result.authenticatorAttachment,
      clientExtensionResults: result.clientExtensionResults ?? {},
      response: result.response,
    };
  },

  async get(options) {
    const result = await Passkey.get(options as unknown as PasskeyGetRequest);
    return {
      id: result.id,
      rawId: result.rawId,
      type: 'public-key',
      authenticatorAttachment: result.authenticatorAttachment,
      clientExtensionResults: result.clientExtensionResults ?? {},
      response: result.response,
    };
  },

  isCancelled(error) {
    return errorCode(error) === 'UserCancelled';
  },

  defaultName() {
    if (Platform.OS === 'ios') return Platform.isPad ? 'iPad' : 'iPhone';
    return 'Android';
  },
};

export default passkeyClient;
