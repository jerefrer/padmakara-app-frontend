const { withInfoPlist } = require('expo/config-plugins');

/**
 * Lets iPhone screens that ask for it turn sideways (readers, read-along, video).
 *
 * The app is portrait (`orientation: "portrait"`), which on iOS writes only the
 * portrait orientations into Info.plist, and iOS never rotates to an orientation
 * missing from that list, so `ScreenOrientation.unlockAsync()` did nothing on
 * iPhone. This adds the landscape ones; the app still starts and stays in portrait
 * because expo-screen-orientation's `initialOrientation: "PORTRAIT_UP"` sets the
 * default lock, and `useUnlockedOrientation` lifts it per screen.
 * Android needs nothing: there the runtime unlock overrides the manifest.
 * The iPad list is left as it is.
 */
const IPHONE_ORIENTATIONS = [
  'UIInterfaceOrientationPortrait',
  'UIInterfaceOrientationLandscapeLeft',
  'UIInterfaceOrientationLandscapeRight',
];

module.exports = function withPhoneLandscape(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UISupportedInterfaceOrientations = IPHONE_ORIENTATIONS;
    return cfg;
  });
};
