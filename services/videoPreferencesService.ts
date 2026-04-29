import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  warnOnCellular: 'video.warnOnCellular',
  allowOnCellular: 'video.allowOnCellular',
} as const;

/**
 * Persistent preferences for video playback:
 *   - warnOnCellular  (default true)  — show a one-tap dialog before starting on cellular
 *   - allowOnCellular (default true)  — when false, refuse cellular playback entirely
 *
 * The "I already accepted on cellular" decision is *not* persisted — it's a
 * per-session memory held in the VideoPlayer screen.
 */
class VideoPreferencesService {
  async getWarnOnCellular(): Promise<boolean> {
    const v = await AsyncStorage.getItem(KEYS.warnOnCellular);
    if (v === null) return true; // default on
    return v === 'true';
  }

  async setWarnOnCellular(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.warnOnCellular, String(value));
  }

  async getAllowOnCellular(): Promise<boolean> {
    const v = await AsyncStorage.getItem(KEYS.allowOnCellular);
    if (v === null) return true; // default on
    return v === 'true';
  }

  async setAllowOnCellular(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.allowOnCellular, String(value));
  }
}

export const videoPreferencesService = new VideoPreferencesService();
export default videoPreferencesService;
