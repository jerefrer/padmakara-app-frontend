module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Temporarily comment out nativewind to fix babel error
      // 'nativewind/babel',
      'react-native-reanimated/plugin',
    ],
  };
};