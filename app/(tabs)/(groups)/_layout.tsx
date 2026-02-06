import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function GroupsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // We handle headers in each screen with AppHeader
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[groupId]" />
      <Stack.Screen name="retreat/[id]" />
      <Stack.Screen name="session/[id]" />
      <Stack.Screen name="transcript/[id]" />
    </Stack>
  );
}
