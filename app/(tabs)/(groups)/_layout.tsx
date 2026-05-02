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
      <Stack.Screen name="retreats/index" />
      <Stack.Screen name="retreats/[code]" />
      <Stack.Screen name="retreat/[id]" />
      <Stack.Screen name="transcript/[id]" />
      <Stack.Screen name="publications" />
      <Stack.Screen name="teacher/[abbreviation]" />
    </Stack>
  );
}
