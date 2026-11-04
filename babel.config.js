module.exports = function (api) {
  api.cache.using(() => process.env.NODE_ENV);
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Debug logs stay out of production: they cost a little on every call and
      // anyone can read them in the browser console. Sentry still gets warn and error.
      ...(isProduction ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : []),
      // Temporarily comment out nativewind to fix babel error
      // 'nativewind/babel',
      // Transform import.meta in pdfjs-dist / react-pdf ESM bundles so Metro
      // (which emits a CJS-style bundle) can execute them.
      ['babel-plugin-transform-import-meta', { module: 'ES6' }],
      'react-native-reanimated/plugin',
    ],
  };
};