import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import i18n, { Language, ContentLanguage } from '@/utils/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LanguageContextType {
  language: Language;
  contentLanguage: ContentLanguage;
  setLanguage: (language: Language) => Promise<void>;
  setContentLanguage: (contentLanguage: ContentLanguage) => Promise<void>;
  t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setCurrentLanguage] = useState<Language>(i18n.getLanguage());
  const [contentLanguage, setCurrentContentLanguage] = useState<ContentLanguage>(i18n.getContentLanguage());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeLanguageState();
  }, []);

  const initializeLanguageState = async () => {
    try {
      // Wait a bit for i18n to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const currentLang = i18n.getLanguage();
      const currentContentLang = i18n.getContentLanguage();
      
      setCurrentLanguage(currentLang);
      setCurrentContentLanguage(currentContentLang);
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
      
      // Also save to AsyncStorage for user preferences
      await AsyncStorage.setItem('user_language_preference', newLanguage);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const handleContentLanguageChange = async (newContentLanguage: ContentLanguage) => {
    try {
      await i18n.setContentLanguage(newContentLanguage);
      setCurrentContentLanguage(newContentLanguage);
      
      // Also save to AsyncStorage for user preferences
      await AsyncStorage.setItem('user_content_language_preference', newContentLanguage);
    } catch (error) {
      console.error('Error changing content language:', error);
    }
  };

  const translate = (key: string, params?: Record<string, string>) => {
    return i18n.t(key, params);
  };

  const value: LanguageContextType = {
    language,
    contentLanguage,
    setLanguage: handleLanguageChange,
    setContentLanguage: handleContentLanguageChange,
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

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}