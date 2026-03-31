import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function GroupsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="events" />
      <Stack.Screen name="retreats-list" />
      <Stack.Screen name="[groupId]" />
      <Stack.Screen name="retreat/[id]" />
      <Stack.Screen name="transcript/[id]" />
      <Stack.Screen name="publications" />
    </Stack>
  );
}
