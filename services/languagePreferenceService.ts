import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LanguagePreference {
  globalPreference?: string;
  retreatPreferences: Array<{
    retreat__id: number;
    retreat__title: string;
    language: string;
  }>;
  defaultLanguage: string;
}

export interface AvailableLanguage {
  code: string;
  name: string;
}

export class LanguagePreferenceService {
  private static instance: LanguagePreferenceService;
  private cache: Map<string, any> = new Map();

  static getInstance(): LanguagePreferenceService {
    if (!LanguagePreferenceService.instance) {
      LanguagePreferenceService.instance = new LanguagePreferenceService();
    }
    return LanguagePreferenceService.instance;
  }

  /**
   * Get user's global and retreat-specific language preferences (local storage only)
   */
  async getUserLanguagePreferences(): Promise<LanguagePreference> {
    const cached = this.cache.get('user_preferences');
    if (cached) return cached;

    try {
      const globalPref = await AsyncStorage.getItem('language_pref_global');
      const prefs: LanguagePreference = {
        globalPreference: globalPref || undefined,
        retreatPreferences: [],
        defaultLanguage: globalPref || 'en',
      };
      this.cache.set('user_preferences', prefs);
      return prefs;
    } catch (error) {
      return { globalPreference: undefined, retreatPreferences: [], defaultLanguage: 'en' };
    }
  }

  /**
   * Set user's global language preference (local storage)
   */
  async setGlobalLanguagePreference(language: string): Promise<boolean> {
    try {
      await AsyncStorage.setItem('language_pref_global', language);
      this.cache.delete('user_preferences');
      return true;
    } catch (error) {
      console.error('Error setting global language preference:', error);
      return false;
    }
  }

  /**
   * Set language preference for a specific retreat (local storage)
   */
  async setRetreatLanguagePreference(sessionId: number, language: string): Promise<boolean> {
    try {
      await this.storeLocalLanguagePreference(sessionId, language);
      this.cache.delete('user_preferences');
      return true;
    } catch (error) {
      console.error('Error setting retreat language preference:', error);
      return false;
    }
  }

  /**
   * Clear language preference for a specific retreat
   */
  async clearRetreatLanguagePreference(retreatId: number): Promise<boolean> {
    try {
      const key = `language_pref_retreat_${retreatId}`;
      await AsyncStorage.removeItem(key);
      this.cache.delete('user_preferences');
      return true;
    } catch (error) {
      console.error('Error clearing retreat language preference:', error);
      return false;
    }
  }

  /**
   * Get effective language for a user and retreat from session data
   */
  getEffectiveLanguageFromSession(sessionData: any): string {
    return sessionData.userLanguage || 'en';
  }

  /**
   * Get available languages from session data
   */
  getAvailableLanguagesFromSession(sessionData: any): AvailableLanguage[] {
    return sessionData.availableLanguages || [{ code: 'en', name: 'English' }];
  }

  /**
   * Check if a retreat has multiple language options
   */
  hasMultipleLanguages(availableLanguages: AvailableLanguage[]): boolean {
    return availableLanguages.length > 1;
  }

  /**
   * Get display name for language code
   */
  getLanguageDisplayName(languageCode: string): string {
    const languageMap: { [key: string]: string } = {
      'en': 'English',
      'pt': 'Português',
      'es': 'Español',
      'fr': 'Français',
      'de': 'Deutsch',
      'it': 'Italiano',
    };
    
    return languageMap[languageCode] || languageCode.toUpperCase();
  }

  /**
   * Store language preference locally for offline usage
   */
  async storeLocalLanguagePreference(retreatId: number, language: string): Promise<void> {
    try {
      const key = `language_pref_retreat_${retreatId}`;
      await AsyncStorage.setItem(key, language);
    } catch (error) {
      console.error('Error storing local language preference:', error);
    }
  }

  /**
   * Get local language preference for offline usage
   */
  async getLocalLanguagePreference(retreatId: number): Promise<string | null> {
    try {
      const key = `language_pref_retreat_${retreatId}`;
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error getting local language preference:', error);
      return null;
    }
  }

  /**
   * Clear all cached preferences (useful when user logs out)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Preload preferences for faster access
   */
  async preloadPreferences(): Promise<void> {
    try {
      await this.getUserLanguagePreferences();
    } catch (error) {
      console.error('Error preloading language preferences:', error);
    }
  }
}