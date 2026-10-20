import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import i18n, { Language } from '@/utils/i18n';
import { defaultShowPortuguese } from '@/utils/contentLanguage';

interface LanguageContextType {
  language: Language;
  /**
   * Whether to include Portuguese audio tracks by default. The only global
   * content-language preference — an event's original language and English
   * are always shown, so there is nothing else to choose here.
   */
  showPortuguese: boolean;
  setLanguage: (language: Language) => Promise<void>;
  setShowPortuguese: (showPortuguese: boolean) => Promise<void>;
  t: (key: string, params?: Record<string, unknown>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setCurrentLanguage] = useState<Language>(i18n.getLanguage());
  const [showPortuguese, setCurrentShowPortuguese] = useState<boolean>(i18n.getShowPortuguese());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeLanguageState();
  }, []);

  const initializeLanguageState = async () => {
    try {
      // Wait a bit for i18n to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const currentLang = i18n.getLanguage();

      setCurrentLanguage(currentLang);
      setCurrentShowPortuguese(i18n.getShowPortuguese());
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing language state:', error);
      setIsInitialized(true);
    }
  };

  const handleLanguageChange = async (newLanguage: Language) => {
    try {
      await i18n.setLanguage(newLanguage);
      setCurrentLanguage(newLanguage);
      // An unset preference is derived from the interface language, so it has
      // to be re-read here: switching the app to Portuguese turns Portuguese
      // tracks on for anyone who never chose.
      setCurrentShowPortuguese(i18n.getShowPortuguese());
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const handleShowPortugueseChange = async (next: boolean) => {
    try {
      await i18n.setShowPortuguese(next);
      setCurrentShowPortuguese(next);
    } catch (error) {
      console.error('Error changing Portuguese preference:', error);
    }
  };

  const translate = (key: string, params?: Record<string, unknown>) => {
    return i18n.t(key, params);
  };

  const value: LanguageContextType = {
    language,
    showPortuguese,
    setLanguage: handleLanguageChange,
    setShowPortuguese: handleShowPortugueseChange,
    t: translate,
  };

  if (!isInitialized) {
    return null; // or a loading spinner
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

const fallback: LanguageContextType = {
  language: 'en' as Language,
  showPortuguese: defaultShowPortuguese('en'),
  setLanguage: async () => {},
  setShowPortuguese: async () => {},
  t: (key: string) => key,
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  // Return fallback during expo-router's initial route evaluation
  // (before providers are mounted)
  if (context === undefined) {
    return fallback;
  }
  return context;
}