import { Stack } from 'expo-router';
import { ReactNode } from 'react';
import { View } from 'react-native';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import {
  RelatedEventsProvider,
  useRelatedEvents,
} from '@/contexts/RelatedEventsContext';
import { RelatedEventsList } from '@/components/desktop/RelatedEventsList';

export const unstable_settings = {
  initialRouteName: 'index',
};

const stack = (
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

// Renders the sidebar above the Stack so it survives event-to-event
// navigation. Hidden when no screen has registered meta (e.g. home,
// teacher, search results).
function DesktopWithSidebar({ children }: { children: ReactNode }) {
  const { meta } = useRelatedEvents();
  return (
    <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
      {meta ? (
        <View style={{ width: 320, flexShrink: 0 }}>
          <RelatedEventsList
            currentEventId={meta.eventId}
            teacherAbbreviation={meta.teacherAbbreviation}
            groupId={meta.groupId}
            headerTitle={meta.headerTitle}
            headerSubtitle={meta.headerSubtitle}
          />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}

export default function GroupsLayout() {
  const { isMobile } = useDesktopLayout();
  return (
    <RelatedEventsProvider>
      {isMobile ? stack : <DesktopWithSidebar>{stack}</DesktopWithSidebar>}
    </RelatedEventsProvider>
  );
}
