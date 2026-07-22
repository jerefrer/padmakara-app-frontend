/**
 * Imperative handle the parent uses to drive the web `<video>` element the
 * same way it drives the native expo-video player (currentTime/duration/
 * play/pause). Only the small surface VideoPlayer actually needs.
 */
export interface WebPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export interface WebHlsVideoProps {
  /** Backend HLS proxy URL (master.m3u8 with a MAT). */
  uri: string;
  /** Seconds to seek to once the manifest is ready. 0 = start. */
  resumePosition: number;
  /** User's content-language preference ('en' | 'en-pt' | 'pt'). */
  contentLanguage: string;
  /** User's UI language ('en' | 'pt') — tiebreak for bilingual readers. */
  uiLanguage: string;
  /** Fired on playback progress with the current time in seconds. */
  onTimeUpdate: (currentTime: number) => void;
  /** Fired when the media element or HLS engine reports a fatal error. */
  onError: () => void;
}
