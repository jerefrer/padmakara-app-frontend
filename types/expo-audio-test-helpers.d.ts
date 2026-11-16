// Test-only helpers that exist solely in __mocks__/expo-audio.ts (jest replaces
// 'expo-audio' with that mock). Declared here so tests can import them with types.
import type { MockPlayer } from '../__mocks__/expo-audio';

declare module 'expo-audio' {
  export function __advanceTime(seconds: number): void;
  export function __finishTrack(): void;
  export function __setDuration(seconds: number): void;
  export function __setPlaying(playing: boolean): void;
  export function __setIsLoaded(loaded: boolean): void;
  export function __reset(): void;
  export function __getRate(): number;
  export function __getLastSeekTo(): number | null;
  export function __getCurrentPlayer(): MockPlayer | null;
}
