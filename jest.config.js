module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|expo-modules-core|expo-audio|@react-native-async-storage|react-native-gesture-handler))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/dist/', '/build/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
