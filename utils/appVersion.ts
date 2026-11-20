import * as Application from 'expo-application';
import Constants from 'expo-constants';

/**
 * "1.0.0 (36)": the version with the store build number (iOS CFBundleVersion, Android
 * versionCode), so testers can say which build they run. The build number comes from the
 * native binary because EAS assigns it remotely; it is absent on web, where only the version
 * from the app config is shown.
 */
export function appVersionLabel(): string {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '';
  const build = Application.nativeBuildVersion;
  if (!version) return build ?? '';
  return build ? `${version} (${build})` : version;
}
