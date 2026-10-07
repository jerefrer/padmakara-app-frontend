import { useState } from 'react';
import { Platform } from 'react-native';
import { membershipColors as c } from './theme';

/**
 * Web only: hide the browser's default focus ring after a mouse click, but keep a visible
 * burgundy outline for keyboard focus (decided with :focus-visible on the focused element).
 * Native gets no extra style.
 */
export function useFocusRing() {
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  if (Platform.OS !== 'web') return { style: undefined, onFocus: undefined, onBlur: undefined };
  const style: any = keyboardFocus
    ? { outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2, outlineColor: c.burgundy[500] }
    : { outlineStyle: 'none' };
  return {
    style,
    onFocus: (e: any) => {
      try {
        setKeyboardFocus(!!e?.target?.matches?.(':focus-visible'));
      } catch {
        setKeyboardFocus(false);
      }
    },
    onBlur: () => setKeyboardFocus(false),
  };
}
