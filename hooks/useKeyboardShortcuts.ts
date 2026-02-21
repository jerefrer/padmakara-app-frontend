import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';

/**
 * Keyboard shortcuts for audio playback on web.
 *
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
      // Don't trigger when typing in inputs
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
