import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="magic-link" />
      <Stack.Screen name="check-email" />
      <Stack.Screen name="approval-pending" />
      <Stack.Screen name="device-activated" />
    </Stack>
  );
}