import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseReadingTheme, type ReadingTheme } from '@/utils/pdfReadingTheme';

/** Same key as the web viewer's localStorage entry; here it lives in AsyncStorage. */
const THEME_KEY = '@pdfViewer:theme';

/**
 * The reading theme of the native PDF readers (normal, sepia, night), kept
 * across documents and launches. Starts on the normal theme until the saved
 * choice is read; a storage failure only means the choice is not remembered.
 */
export function useReadingTheme(): [ReadingTheme, (theme: ReadingTheme) => void] {
  const [theme, setThemeState] = useState<ReadingTheme>('normal');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (!cancelled) setThemeState(parseReadingTheme(saved));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((next: ReadingTheme) => {
    setThemeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  }, []);

  return [theme, setTheme];
}
