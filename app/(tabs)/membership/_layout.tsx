import { Stack } from 'expo-router';

// A reload on /membership/pay must leave index beneath, so Back lands on /membership.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function MembershipLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
