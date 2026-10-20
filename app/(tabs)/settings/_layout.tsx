import { Stack } from 'expo-router';

// A reload on /settings/<section> must leave the index beneath, so Back lands on Settings.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
