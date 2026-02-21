import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';

/**
 * Keyboard shortcuts for audio playback on web.
 *
 * Cmd/Ctrl+K   - Open search
 * Space        - Play / Pause
 * ArrowLeft    - Rewind 15s
 * ArrowRight   - Forward 15s
 * Shift+Left   - Previous track
 * Shift+Right  - Next track
 * [            - Decrease speed (cycles)
 * ]            - Increase speed (cycles)
 */
export function useKeyboardShortcuts() {
  const audio = useAudioPlayerContext();

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K → open search (works even when typing in inputs)
      if (e.key === 'k' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        router.push('/(tabs)/search' as any);
        // Focus the search input after navigation
        setTimeout(() => {
          const input = document.querySelector('input[type="text"], input:not([type])') as HTMLInputElement;
          input?.focus();
        }, 100);
        return;
      }

      // Don't trigger other shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Only handle if a track is loaded
      if (!audio.currentTrack) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          audio.togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            audio.previousTrack();
          } else {
            audio.skipBackward();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            audio.nextTrack();
          } else {
            audio.skipForward();
          }
          break;
        case '[':
          audio.changePlaybackSpeed();
          break;
        case ']':
          audio.changePlaybackSpeed();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [audio]);
}
