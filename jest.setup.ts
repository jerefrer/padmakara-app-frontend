// Register the official AsyncStorage mock before any test code imports it.
// jest.mock calls in setupFilesAfterEnv files are hoisted by babel-jest and
// apply to all subsequent imports in each test file's context.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-audio'); // resolves to __mocks__/expo-audio.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { __reset as __resetAudio } from 'expo-audio';

afterEach(async () => {
  await AsyncStorage.clear();
  __resetAudio();
  jest.clearAllMocks();
  jest.useRealTimers();
});
