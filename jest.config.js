module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|expo-modules-core|expo-audio|@react-native-async-storage|react-native-gesture-handler))',
  ],
  // Reanimated 4.7 needs its resolver to load the JS implementation under jest.
  resolver: 'react-native-reanimated/jest/resolver.js',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/dist/', '/build/', '/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
