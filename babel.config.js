module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Temporarily comment out nativewind to fix babel error
      // 'nativewind/babel',
      // Transform import.meta in pdfjs-dist / react-pdf ESM bundles so Metro
      // (which emits a CJS-style bundle) can execute them.
      ['babel-plugin-transform-import-meta', { module: 'ES6' }],
      'react-native-reanimated/plugin',
    ],
  };
};