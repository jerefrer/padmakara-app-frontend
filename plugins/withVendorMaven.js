const { withProjectBuildGradle } = require('expo/config-plugins');

/**
 * Makes the vendored Maven repository in vendor/android-pdf-viewer/maven
 * visible to the Android build.
 *
 * The patched react-native-pdf depends on our build of AndroidPdfViewer
 * (org.padmakara.vendor:android-pdf-viewer, see vendor/android-pdf-viewer). The
 * app resolves its libraries' dependencies with the root project's
 * repositories, so the repository goes into `allprojects`. It is exclusive to
 * that group: Gradle looks for the vendored library only there and never asks
 * the remote repositories for it.
 */
const MARKER = 'vendor/android-pdf-viewer/maven';
const REPOSITORY = `
    exclusiveContent {
      forRepository {
        maven { url "\${rootDir}/../${MARKER}" }
      }
      filter {
        includeGroup "org.padmakara.vendor"
      }
    }`;

function addVendorRepository(contents) {
  if (contents.includes(MARKER)) return contents;
  const anchor = /allprojects\s*\{\s*repositories\s*\{/;
  if (!anchor.test(contents)) {
    throw new Error('withVendorMaven: no "allprojects { repositories {" block in android/build.gradle');
  }
  return contents.replace(anchor, (block) => `${block}${REPOSITORY}`);
}

function withVendorMaven(config) {
  return withProjectBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addVendorRepository(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withVendorMaven;
module.exports.addVendorRepository = addVendorRepository;
