import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Import translations
import en from '../locales/en.json';
import pt from '../locales/pt.json';

export type Language = 'en' | 'pt';
export type ContentLanguage = 'en' | 'en-pt';

const translations = {
  en,
  pt,
};

class I18n {
  private currentLanguage: Language = 'en';
  private currentContentLanguage: ContentLanguage = 'en';
  
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
      let storedContentLanguage: string | null = null;
      
      try {
        storedLanguage = await AsyncStorage.getItem('app_language');
        storedContentLanguage = await AsyncStorage.getItem('content_language');
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

      if (storedContentLanguage && (storedContentLanguage === 'en' || storedContentLanguage === 'en-pt')) {
        this.currentContentLanguage = storedContentLanguage as ContentLanguage;
      }
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

  async setContentLanguage(contentLanguage: ContentLanguage) {
    this.currentContentLanguage = contentLanguage;
    try {
      await AsyncStorage.setItem('content_language', contentLanguage);
    } catch (error) {
      console.error('Error saving content language:', error);
    }
  }

  getLanguage(): Language {
    return this.currentLanguage;
  }

  getContentLanguage(): ContentLanguage {
    return this.currentContentLanguage;
  }

  t(key: string, params?: Record<string, string>): string {
    const keys = key.split('.');
    let value: any = translations[this.currentLanguage];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    if (typeof value !== 'string') {
      console.warn(`Translation key "${key}" not found for language "${this.currentLanguage}"`);
      return key;
    }

    // Replace parameters
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match: string, paramKey: string) => {
        return params[paramKey] || match;
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

export default new I18n();