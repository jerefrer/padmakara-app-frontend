const { getSentryExpoConfig } = require('@sentry/react-native/metro');
// const { withNativeWind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname);

// Temporarily disable nativewind to fix babel error
module.exports = config;
// module.exports = withNativeWind(config, { input: './global.css' });