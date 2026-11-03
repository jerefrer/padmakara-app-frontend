const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * Brands the media notification's small icon with the Padmakara wheel.
 *
 * expo-audio builds its notification with media3's `media3_icon_circular_play`
 * drawable, with no option to change it, and Samsung shows that icon as the only
 * hint of which app is playing. An app resource with the same name overrides a
 * library's, so the wheel is copied under that name into every density folder.
 * The PNGs (white on transparent, 24 dp) live in assets/notification-icon/.
 */
const ICON_NAME = 'media3_icon_circular_play.png';

module.exports = function withMediaNotificationIcon(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const sourceRoot = path.join(cfg.modRequest.projectRoot, 'assets', 'notification-icon');
      const resRoot = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      for (const folder of fs.readdirSync(sourceRoot)) {
        const source = path.join(sourceRoot, folder, ICON_NAME);
        if (!fs.existsSync(source)) continue;
        const target = path.join(resRoot, folder);
        fs.mkdirSync(target, { recursive: true });
        fs.copyFileSync(source, path.join(target, ICON_NAME));
      }
      return cfg;
    },
  ]);
};
