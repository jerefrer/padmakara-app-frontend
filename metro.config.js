const { getSentryExpoConfig } = require('@sentry/react-native/metro');
// const { withNativeWind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname);

// pdf.js 6 (through react-pdf, web only) targets the newest browsers: an older
// one crashed opening a PDF (Chrome 138 has no Uint8Array.toHex). Its legacy
// build runs everywhere; the native apps use react-native-pdf instead.
const PDFJS_LEGACY = {
  'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf.mjs',
  'pdfjs-dist/web/pdf_viewer.mjs': 'pdfjs-dist/legacy/web/pdf_viewer.mjs',
};
const parentResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = (platform === 'web' && PDFJS_LEGACY[moduleName]) || moduleName;
  const resolve = parentResolveRequest ?? context.resolveRequest;
  return resolve(context, target, platform);
};

// Temporarily disable nativewind to fix babel error
module.exports = config;
// module.exports = withNativeWind(config, { input: './global.css' });