// Register the official AsyncStorage mock before any test code imports it.
// jest.mock calls in setupFilesAfterEnv files are hoisted by babel-jest and
// apply to all subsequent imports in each test file's context.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-audio'); // resolves to __mocks__/expo-audio.ts
// jest-expo 58 registers its asset-registry mock where react-native's own AssetRegistry does not
// read it, so loading the icon fonts (which are required as module id 1) rejects with
// "Module 1 is missing from the asset registry". Font loading is irrelevant to these tests.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  loadAsync: jest.fn(() => Promise.resolve()),
}));
// The Sentry SDK ships untranspiled ESM and reports nothing in tests anyway.
jest.mock('@sentry/react-native', () => ({ setUser: jest.fn(), captureException: jest.fn(() => 'test-event-id') }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { __reset as __resetAudio } from 'expo-audio';

afterEach(async () => {
  await AsyncStorage.clear();
  __resetAudio();
  jest.clearAllMocks();
  jest.useRealTimers();
});
