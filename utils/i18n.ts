import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Import translations
import en from '../locales/en.json';
import pt from '../locales/pt.json';
import {
  defaultShowPortuguese,
  parseShowPortuguese,
  showPortugueseFromLegacy,
} from './contentLanguage';

export type Language = 'en' | 'pt';

const translations = {
  en,
  pt,
};

class I18n {
  private currentLanguage: Language = 'en';
  /**
   * Whether to include Portuguese tracks, or `null` when the user has never
   * chosen. Kept nullable so an unset preference stays *derived* from the
   * interface language: switching the app to Portuguese turns Portuguese
   * tracks on for anyone who has not overridden it.
   */
  private storedShowPortuguese: boolean | null = null;
  
  constructor() {
    // Only initialize on native platforms, defer on web to avoid window error
    if (Platform.OS !== 'web') {
      this.initializeLanguage();
    }
  }

  private async initializeLanguage() {
    try {
      // Get stored language preference - add safety check for web
      let storedLanguage: string | null = null;
      let storedShowPortuguese: string | null = null;
      let legacyContentLanguage: string | null = null;

      try {
        storedLanguage = await AsyncStorage.getItem('app_language');
        storedShowPortuguese = await AsyncStorage.getItem('show_portuguese');
        legacyContentLanguage = await AsyncStorage.getItem('content_language');
      } catch (asyncStorageError) {
        console.warn('AsyncStorage not available, using defaults:', asyncStorageError);
      }
      
      if (storedLanguage && (storedLanguage === 'en' || storedLanguage === 'pt')) {
        this.currentLanguage = storedLanguage as Language;
      } else {
        // Detect device language
        const deviceLocales = getLocales();
        const deviceLanguage = deviceLocales[0]?.languageCode;
        
        if (deviceLanguage === 'pt') {
          this.currentLanguage = 'pt';
        } else {
          this.currentLanguage = 'en';
        }
      }

      // The old `content_language` key held 'en' | 'en-pt' | 'pt'. It is read
      // only as a fallback, so an existing preference carries over to the new
      // toggle instead of being silently reset.
      this.storedShowPortuguese =
        parseShowPortuguese(storedShowPortuguese) ??
        showPortugueseFromLegacy(legacyContentLanguage);
    } catch (error) {
      console.error('Error initializing language:', error);
    }
  }

  async setLanguage(language: Language) {
    this.currentLanguage = language;
    try {
      await AsyncStorage.setItem('app_language', language);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  }

  async setShowPortuguese(showPortuguese: boolean) {
    this.storedShowPortuguese = showPortuguese;
    try {
      await AsyncStorage.setItem('show_portuguese', String(showPortuguese));
    } catch (error) {
      console.error('Error saving Portuguese preference:', error);
    }
  }

  getLanguage(): Language {
    return this.currentLanguage;
  }

  getShowPortuguese(): boolean {
    return this.storedShowPortuguese ?? defaultShowPortuguese(this.currentLanguage);
  }

  /**
   * Look up a translation for the current interface language.
   *
   * A missing key resolves to `''`, never to the key itself. Call sites all
   * use the `t('some.key') || 'Fallback'` idiom, and a returned key string is
   * truthy — it would swallow the fallback and render "retreats.other" to the
   * user. An empty string lets the fallback do its job, and a site with no
   * fallback renders nothing rather than leaking an internal key.
   *
   * Misses are a bug in every case, so they warn in development. `locales.test.ts`
   * asserts that no static `t()` key in the codebase can miss.
   */
  t(key: string, params?: Record<string, unknown>): string {
    const keys = key.split('.');
    let value: any = translations[this.currentLanguage];

    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value !== 'string') {
      if (__DEV__) {
        console.warn(`Translation key "${key}" not found for language "${this.currentLanguage}"`);
      }
      return '';
    }

    // Replace parameters
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match: string, paramKey: string) => {
        return paramKey in params ? String(params[paramKey]) : match;
      });
    }

    return value;
  }
  
  // Method to manually initialize (for web platform)
  async initialize(): Promise<void> {
    await this.initializeLanguage();
  }
  
  // Check if AsyncStorage is available
  private isAsyncStorageAvailable(): boolean {
    try {
      return typeof AsyncStorage !== 'undefined' && Platform.OS !== 'web';
    } catch {
      return false;
    }
  }
}

/**
 * Resolve a translated name from an API object's name_translations field.
 * Falls back to the default `name` field if no translation is available.
 */
export function getTranslatedName(
  obj: { name: string; name_translations?: Record<string, string> },
  lang: Language
): string {
  return obj.name_translations?.[lang]?.trim() || obj.name;
}

/**
 * Resolve a track's title in the given interface language.
 * Combined multi-language tracks carry `title_translations`; split tracks
 * don't, so this falls back to the single `title`.
 */
export function getTrackTitle(
  track: { title: string; title_translations?: { en?: string; pt?: string } },
  lang: Language,
): string {
  return track.title_translations?.[lang]?.trim() || track.title;
}

export default new I18n();