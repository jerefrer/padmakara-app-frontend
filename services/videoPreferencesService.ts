import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseSubtitleChoice } from '@/utils/subtitlePreference';

const KEYS = {
  warnOnCellular: 'video.warnOnCellular',
  allowOnCellular: 'video.allowOnCellular',
  subtitleLanguage: 'video.subtitleLanguage',
} as const;

/**
 * Persistent preferences for video playback:
 *   - warnOnCellular  (default true)  — show a one-tap dialog before starting on cellular
 *   - allowOnCellular (default true)  — when false, refuse cellular playback entirely
 *   - subtitleLanguage (default null) — the subtitle language to turn on when a video starts,
 *     or 'off'; null means the viewer never chose, so the interface language applies
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

  async getSubtitleLanguage(): Promise<string | null> {
    return parseSubtitleChoice(await AsyncStorage.getItem(KEYS.subtitleLanguage));
  }

  async setSubtitleLanguage(value: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.subtitleLanguage, value);
  }
}

export const videoPreferencesService = new VideoPreferencesService();
export default videoPreferencesService;
