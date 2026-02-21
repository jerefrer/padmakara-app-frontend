# Desktop Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Padmakara web/desktop experience from a stretched mobile app into a proper desktop application with sidebar navigation, master-detail content, and a persistent bottom player bar — while keeping mobile layouts completely unchanged.

**Architecture:** On web when viewport >= 768px, the `(tabs)/_layout.tsx` wraps Expo Router's `<Tabs>` inside a `<DesktopShell>` that adds a left sidebar and bottom player bar. The `<Tabs>` tab bar is hidden via CSS. On mobile (or web < 768px), everything renders exactly as before. Audio state is lifted to a context so the player bar can persist across screen navigation.

**Tech Stack:** React Native Web, Expo Router v5, StyleSheet + web-specific inline styles for CSS Grid, `useWindowDimensions()` for breakpoints, React Context for audio state.

**Design Doc:** `docs/plans/2026-02-21-desktop-layout-design.md`

---

## Phase 1: Foundation

### Task 1: Create `useDesktopLayout` hook

**Files:**
- Create: `hooks/useDesktopLayout.ts`

**Step 1: Create the hook file**

```typescript
// hooks/useDesktopLayout.ts
import { Platform, useWindowDimensions } from 'react-native';

export interface DesktopLayout {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  showSidebar: boolean;
  showMasterDetail: boolean;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  playerBarHeight: number;
}

export function useDesktopLayout(): DesktopLayout {
  const isWeb = Platform.OS === 'web';
  const { width } = useWindowDimensions();

  const isMobile = !isWeb || width < 768;
  const isTablet = isWeb && width >= 768 && width < 1025;
  const isDesktop = isWeb && width >= 1025;
  const isWide = isWeb && width > 1440;
  const showSidebar = isWeb && width >= 768;
  const sidebarCollapsed = isTablet;

  return {
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    showSidebar,
    showMasterDetail: isDesktop,
    sidebarCollapsed,
    sidebarWidth: sidebarCollapsed ? 64 : 240,
    playerBarHeight: 80,
  };
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/jeremy/Documents/Programming/padmakara-backend-frontend/padmakara-app && npx tsc --noEmit hooks/useDesktopLayout.ts 2>&1 || echo "Check for errors"`

**Step 3: Commit**

```bash
git add hooks/useDesktopLayout.ts
git commit -m "feat: add useDesktopLayout hook for responsive breakpoints"
```

---

### Task 2: Create shared color constants

The colors object is duplicated across retreat/[id].tsx and AudioPlayer.tsx. Extract it to a shared file for reuse by new desktop components.

**Files:**
- Create: `constants/colors.ts`

**Step 1: Create the shared colors file**

```typescript
// constants/colors.ts
export const colors = {
  cream: {
    50: '#fefdfb',
    100: '#fcf8f3',
    200: '#f7f0e4',
    500: '#e8d8b7',
  },
  burgundy: {
    50: '#fef2f2',
    100: '#fde6e6',
    500: '#b91c1c',
    600: '#991b1b',
    700: '#7f1d1d',
  },
  saffron: {
    50: '#fffbeb',
    500: '#f59e0b',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
  },
  white: '#ffffff',
};
```

**Step 2: Commit**

```bash
git add constants/colors.ts
git commit -m "feat: extract shared color constants"
```

---

### Task 3: Create `DesktopShell` layout component

This is the grid container that wraps the entire desktop experience: sidebar on the left, main content in the center, player bar at the bottom.

**Files:**
- Create: `components/desktop/DesktopShell.tsx`

**Step 1: Create the component**

```typescript
// components/desktop/DesktopShell.tsx
import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { colors } from '@/constants/colors';

interface DesktopShellProps {
  sidebar: ReactNode;
  children: ReactNode;  // main content (the Tabs navigator output)
  playerBar?: ReactNode;
}

export function DesktopShell({ sidebar, children, playerBar }: DesktopShellProps) {
  const { sidebarWidth, playerBarHeight } = useDesktopLayout();

  return (
    <View
      style={[
        styles.shell,
        Platform.OS === 'web' && ({
          display: 'grid' as any,
          gridTemplateColumns: `${sidebarWidth}px 1fr`,
          gridTemplateRows: playerBar ? `1fr ${playerBarHeight}px` : '1fr',
          height: '100vh',
          overflow: 'hidden',
        } as any),
      ]}
    >
      {/* Sidebar */}
      <View
        style={[
          styles.sidebarContainer,
          Platform.OS === 'web' && ({
            gridColumn: '1',
            gridRow: '1',
            overflow: 'auto' as any,
          } as any),
        ]}
      >
        {sidebar}
      </View>

      {/* Main Content */}
      <View
        style={[
          styles.mainContent,
          Platform.OS === 'web' && ({
            gridColumn: '2',
            gridRow: '1',
            overflow: 'auto' as any,
          } as any),
        ]}
      >
        {children}
      </View>

      {/* Player Bar */}
      {playerBar && (
        <View
          style={[
            styles.playerBar,
            Platform.OS === 'web' && ({
              gridColumn: '1 / -1',
              gridRow: '2',
            } as any),
          ]}
        >
          {playerBar}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  sidebarContainer: {
    backgroundColor: colors.white,
    borderRightWidth: 1,
    borderRightColor: colors.gray[200],
  },
  mainContent: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  playerBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
});
```

**Step 2: Commit**

```bash
git add components/desktop/DesktopShell.tsx
git commit -m "feat: add DesktopShell grid layout component"
```

---

### Task 4: Create initial `Sidebar` component (nav items only, no drill-down yet)

Start with just the fixed navigation items (Home, Events, Settings, Subscription) and the logo. The drill-down content list comes in Phase 2.

**Files:**
- Create: `components/desktop/Sidebar.tsx`

**Step 1: Create the component**

The sidebar needs to:
- Show the Padmakara logo and app name at the top
- Show fixed nav items (Home, Events, Settings, Subscription)
- Highlight the currently active nav item
- Navigate using Expo Router when items are clicked
- Show a user footer at the bottom

Use `usePathname()` from expo-router to determine the active route. Use `router.push()` to navigate.

Nav items map to the same routes as the tab bar:
- Home → `/(tabs)/(groups)` (the groups index, which is the "Retreats" tab)
- Events → `/(tabs)/(events)`
- Settings → `/(tabs)/settings`
- Subscription → `/(tabs)/subscription`

The sidebar item for "Home" should be active when on any `(groups)` route. Events when on `(events)`. Settings when on `settings`. Subscription when on `subscription`.

Style each nav item as a row with icon + label. Active item gets cream background with burgundy left border.

**Step 2: Commit**

```bash
git add components/desktop/Sidebar.tsx
git commit -m "feat: add Sidebar component with nav items"
```

---

### Task 5: Modify `(tabs)/_layout.tsx` to render desktop layout on web

This is the critical integration point. On desktop, we:
1. Wrap the `<Tabs>` inside `<DesktopShell>`
2. Hide the tab bar (since sidebar replaces it)
3. Pass `<Sidebar>` to the shell

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

**Step 1: Add desktop conditional rendering**

The existing `<Tabs>` component stays — it still handles screen registration and routing. We just hide the tab bar on desktop and wrap everything in the shell.

```typescript
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { Sidebar } from '@/components/desktop/Sidebar';

export default function TabLayout() {
  const { t } = useLanguage();
  const { isMobile } = useDesktopLayout();

  const tabsElement = (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#b91c1c',
        tabBarInactiveTintColor: '#6b7280',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: isMobile
          ? Platform.select({
              ios: { position: 'absolute', backgroundColor: '#f8f8f8' },
              default: { backgroundColor: '#f8f8f8' },
            })
          : { display: 'none' }, // Hide tab bar on desktop — sidebar replaces it
      }}
    >
      {/* ... same Tabs.Screen definitions as before ... */}
    </Tabs>
  );

  if (isMobile) {
    return tabsElement;
  }

  return (
    <DesktopShell sidebar={<Sidebar />}>
      {tabsElement}
    </DesktopShell>
  );
}
```

**Step 2: Test on web**

Run: `cd /Users/jeremy/Documents/Programming/padmakara-backend-frontend/padmakara-app && npx expo start --web`

Verify:
- Desktop browser (>1025px): sidebar visible on left, tab bar hidden, content fills remaining space
- Mobile viewport or actual mobile: bottom tab bar visible, no sidebar (exact same as before)

**Step 3: Commit**

```bash
git add app/(tabs)/_layout.tsx
git commit -m "feat: wrap tabs in DesktopShell on web, hide tab bar on desktop"
```

---

### Task 6: Hide `AppHeader` on desktop

On desktop, the sidebar replaces the header's navigation function. The AppHeader should be hidden when the sidebar is visible.

**Files:**
- Modify: `components/ui/AppHeader.tsx`

**Step 1: Add desktop detection**

Add `useDesktopLayout()` to AppHeader. When `showSidebar` is true, return `null`.

```typescript
import { useDesktopLayout } from '@/hooks/useDesktopLayout';

export default function AppHeader({ showBackButton, onBackPress, title }: AppHeaderProps) {
  const { showSidebar } = useDesktopLayout();

  if (showSidebar) {
    return null; // Sidebar handles navigation on desktop
  }

  // ... rest of existing component unchanged ...
}
```

**Step 2: Test**

Verify on web: no duplicate header when sidebar is visible. Verify on mobile: header still appears normally.

**Step 3: Commit**

```bash
git add components/ui/AppHeader.tsx
git commit -m "feat: hide AppHeader when desktop sidebar is visible"
```

---

## Phase 2: Sidebar Drill-Down

### Task 7: Create `SidebarNavigationContext` for sidebar state

The sidebar needs shared state to track:
- Current drill-down level (0=groups, 1=retreats, 2=sessions)
- The data at each level (groups list, retreat list, session list)
- The active item at each level

**Files:**
- Create: `contexts/SidebarNavigationContext.tsx`

**Step 1: Create the context**

```typescript
// contexts/SidebarNavigationContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarLevel {
  type: 'groups' | 'retreats' | 'sessions';
  parentId?: string;   // groupId or retreatId
  parentName?: string; // for breadcrumb display
}

interface SidebarNavigationContextType {
  level: SidebarLevel;
  activeItemId: string | null;
  drillDown: (type: SidebarLevel['type'], parentId: string, parentName: string) => void;
  goBack: () => void;
  setActiveItem: (id: string | null) => void;
  breadcrumbStack: SidebarLevel[];
}

// ... implement with useState, breadcrumbStack as array of levels
```

The context maintains a stack of levels. `drillDown` pushes a new level. `goBack` pops back to the previous level.

**Step 2: Wrap the context provider**

Add `<SidebarNavigationProvider>` inside `(tabs)/_layout.tsx`, wrapping the desktop shell. Only needed on desktop.

**Step 3: Commit**

```bash
git add contexts/SidebarNavigationContext.tsx app/(tabs)/_layout.tsx
git commit -m "feat: add SidebarNavigationContext for drill-down state"
```

---

### Task 8: Add groups data fetching to sidebar

The sidebar at Level 0 needs to display the user's groups. Reuse the same API call that `(groups)/index.tsx` uses.

**Files:**
- Modify: `components/desktop/Sidebar.tsx`

**Step 1: Fetch groups in sidebar**

Use the same `retreatService` or API endpoint that the groups index screen uses. Display the groups list below the nav items section. Each group item shows the group name (translated).

When a group is clicked:
1. Call `drillDown('retreats', groupId, groupName)` on the sidebar context
2. Call `router.push(\`/(tabs)/(groups)/${groupId}\`)` to navigate the main content

**Step 2: Add Level 1 — retreats list**

When the sidebar context is at `type: 'retreats'`, fetch retreats for the group (same API as `[groupId].tsx`). Display them grouped by year with the breadcrumb back link "← Your Groups" at top.

When a retreat is clicked:
1. Call `drillDown('sessions', retreatId, retreatName)`
2. Call `router.push(\`/(tabs)/(groups)/retreat/${retreatId}\`)`

**Step 3: Add Level 2 — sessions list**

When at `type: 'sessions'`, fetch sessions for the retreat. Display session list with day/time labels. Breadcrumb shows "← Group Name".

When a session is clicked:
1. Call `setActiveItem(sessionId)` (highlight in sidebar)
2. The main content already shows this retreat's tracks — scroll to or filter to that session

**Step 4: Test drill-down flow**

Navigate: Click group → see retreats → click retreat → see sessions. Click breadcrumbs to go back. Verify the main content area updates in sync.

**Step 5: Commit**

```bash
git add components/desktop/Sidebar.tsx contexts/SidebarNavigationContext.tsx
git commit -m "feat: add sidebar drill-down with groups, retreats, sessions"
```

---

### Task 9: Synchronize sidebar with route changes

When the user navigates via the main content (clicking a group card or retreat card), the sidebar should update to match. Listen to route changes and update the sidebar context.

**Files:**
- Modify: `components/desktop/Sidebar.tsx`

**Step 1: Add route synchronization**

Use `usePathname()` and `useLocalSearchParams()` to detect current route. When the path changes:
- `/(tabs)/(groups)` → Level 0 (groups)
- `/(tabs)/(groups)/[groupId]` → Level 1 (retreats for that group)
- `/(tabs)/(groups)/retreat/[id]` → Level 2 (sessions for that retreat)

Sync the sidebar context accordingly so the sidebar always reflects where the user is.

**Step 2: Test bidirectional sync**

- Click a group card in main content → sidebar drills to Level 1
- Click breadcrumb in sidebar → main content navigates back
- Use browser back button → sidebar updates correctly

**Step 3: Commit**

```bash
git add components/desktop/Sidebar.tsx
git commit -m "feat: sync sidebar state with route changes"
```

---

### Task 10: Add user footer to sidebar

**Files:**
- Modify: `components/desktop/Sidebar.tsx`

**Step 1: Add user info footer**

At the bottom of the sidebar, show the user's name and subscription status. Use `useAuth()` context for user data.

```
─────────────────
👤 Jeremy · Subscriber
```

If not authenticated, show "Sign In" link instead.

**Step 2: Commit**

```bash
git add components/desktop/Sidebar.tsx
git commit -m "feat: add user footer to sidebar"
```

---

## Phase 3: Desktop Player Bar

### Task 11: Create `AudioPlayerContext` to lift audio state

Currently all audio state lives inside `AudioPlayer.tsx` component (1121 lines). For the desktop player bar to persist across navigation, we need to lift the core audio state (current track, playing status, position, duration, track list) into a context.

This is the largest refactor in the plan. The approach:
1. Create `AudioPlayerContext` with the audio engine (Audio.Sound management)
2. The existing `AudioPlayer` component becomes a "view" that consumes from the context
3. On desktop, `DesktopPlayerBar` also consumes from the same context
4. On mobile, behavior is identical (the context just wraps the existing logic)

**Files:**
- Create: `contexts/AudioPlayerContext.tsx`
- Modify: `components/AudioPlayer.tsx` (consume from context instead of managing state directly)
- Modify: `app/(tabs)/(groups)/retreat/[id].tsx` (use context to set tracks)

**Step 1: Create the context**

The context exposes:
```typescript
interface AudioPlayerContextType {
  // State
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;      // in seconds
  duration: number;      // in seconds
  playbackSpeed: number;
  isLoading: boolean;
  playerState: string;   // LOADING, READY, RESTORED, PLAYING, SEEKING
  trackList: Track[];    // all tracks in current session
  currentTrackIndex: number;
  retreatId: string | null;
  retreatName: string | null;
  groupName: string | null;

  // Actions
  playTrack: (track: Track, trackList: Track[], index: number, meta?: { retreatId: string; retreatName: string; groupName: string }) => void;
  pause: () => void;
  resume: () => void;
  seekTo: (positionMs: number) => void;
  skipForward: () => void;   // +15s
  skipBackward: () => void;  // -15s
  nextTrack: () => void;
  previousTrack: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setUpcomingTracks: (tracks: Track[]) => void;

  // Callbacks for retreat screen
  onProgressUpdate?: (trackId: string, position: number, duration: number) => void;
  onTrackComplete?: () => void;
  setOnProgressUpdate: (cb: ((trackId: string, position: number, duration: number) => void) | undefined) => void;
  setOnTrackComplete: (cb: (() => void) | undefined) => void;
}
```

Move the Audio.Sound management, position restoration, pre-caching logic from `AudioPlayer.tsx` into this context provider. The context provider wraps the entire app (in `app/_layout.tsx`).

**Step 2: Refactor AudioPlayer.tsx to be a "view only" component**

The AudioPlayer component should:
- Consume all state from `useAudioPlayer()` context
- Only render the UI (controls, progress bar, track info)
- Not manage any Audio.Sound objects directly
- Keep its existing visual layout for mobile

On mobile, it renders exactly as before (position absolute, bottom of screen).

**Step 3: Update retreat/[id].tsx to use context**

Replace direct `<AudioPlayer>` props with context calls:
- When user selects a track: call `context.playTrack(track, filteredTracks, index, { retreatId, retreatName, groupName })`
- Register callbacks: `context.setOnProgressUpdate(handleProgressUpdate)` and `context.setOnTrackComplete(handleTrackComplete)`
- The `<AudioPlayer>` component is still rendered in retreat screen on mobile, but it reads from context

**Step 4: Add AudioPlayerProvider to root layout**

Wrap in `app/_layout.tsx`:
```typescript
<AuthProvider>
  <LanguageProvider>
    <AudioPlayerProvider>
      {/* ... Stack ... */}
    </AudioPlayerProvider>
  </LanguageProvider>
</AuthProvider>
```

**Step 5: Test audio playback still works**

Run the web app, navigate to a retreat, play a track. Verify:
- Playback works
- Position restoration works
- Speed control works
- Next/previous track works
- Progress tracking works

**Step 6: Commit**

```bash
git add contexts/AudioPlayerContext.tsx components/AudioPlayer.tsx app/(tabs)/(groups)/retreat/[id].tsx app/_layout.tsx
git commit -m "feat: lift audio state to AudioPlayerContext for persistent playback"
```

---

### Task 12: Create `DesktopPlayerBar` component (compact mode)

**Files:**
- Create: `components/desktop/DesktopPlayerBar.tsx`

**Step 1: Create the compact player bar**

Consumes from `useAudioPlayer()` context. Renders the three-zone layout:

**Left zone (~300px):** Playing animation bars + track title + subtitle (group · retreat name)
**Center zone (flex):** Transport controls row (prev, -15s, play/pause, +15s, next) + progress slider
**Right zone (~200px):** Speed button + expand chevron

Returns `null` when `currentTrack` is null (no track playing).

The layout uses `flexDirection: 'row'` with the three zones.

**Step 2: Wire into DesktopShell**

In `(tabs)/_layout.tsx`, pass the player bar to the shell:

```typescript
<DesktopShell
  sidebar={<Sidebar />}
  playerBar={<DesktopPlayerBar />}
>
  {tabsElement}
</DesktopShell>
```

**Step 3: Test**

Play a track on a retreat page. Verify the player bar appears at the bottom spanning full width. Navigate to settings — player bar stays visible and playback continues (because audio state is in context now). Navigate back to retreat — still playing.

**Step 4: Commit**

```bash
git add components/desktop/DesktopPlayerBar.tsx app/(tabs)/_layout.tsx
git commit -m "feat: add DesktopPlayerBar compact mode"
```

---

### Task 13: Hide mobile AudioPlayer on desktop

On desktop, the bottom player bar replaces the inline AudioPlayer. The retreat screen should not render the AudioPlayer component when on desktop.

**Files:**
- Modify: `app/(tabs)/(groups)/retreat/[id].tsx`

**Step 1: Conditionally hide AudioPlayer**

```typescript
const { isMobile } = useDesktopLayout();

// In the JSX, wrap the AudioPlayer:
{isMobile && (
  <AudioPlayer
    track={currentTrack}
    // ... same props ...
  />
)}
```

On desktop, the DesktopPlayerBar (from Task 12) handles the player UI.

**Step 2: Adjust scroll padding**

On mobile, the scroll content has `paddingBottom: 180` to account for the inline player. On desktop, reduce this since the player bar is outside the scroll area (but still leave some padding for the grid's player bar row).

**Step 3: Commit**

```bash
git add app/(tabs)/(groups)/retreat/[id].tsx
git commit -m "feat: hide inline AudioPlayer on desktop, use DesktopPlayerBar instead"
```

---

## Phase 4: Main Content Enhancements

### Task 14: Create `HomeDashboard` component

When the user is on the "Home" view (groups index), show a richer dashboard on desktop with "Continue Listening" and recent retreat cards.

**Files:**
- Create: `components/desktop/HomeDashboard.tsx`
- Modify: `app/(tabs)/(groups)/index.tsx`

**Step 1: Create HomeDashboard component**

Shows:
- Greeting: "Good morning/afternoon/evening, {firstName}"
- "Continue Listening" card (if there's a last-played track in AsyncStorage)
  - Track name, session name, retreat name, remaining time
  - Click navigates to that retreat and resumes playback
- "Recent Retreats" section: 2-3 column grid of recent retreat cards with progress

Use AsyncStorage to read last-played track info. Use the groups/retreats API data.

**Step 2: Integrate into groups index**

In `(groups)/index.tsx`, on desktop, render `<HomeDashboard>` above or instead of the simple group list (the sidebar already has the group list).

```typescript
const { isDesktop } = useDesktopLayout();

if (isDesktop) {
  return <HomeDashboard groups={groups} />;
}

// ... existing mobile layout ...
```

**Step 3: Test**

Navigate to Home on desktop. See dashboard with greeting, continue listening card, recent retreats.

**Step 4: Commit**

```bash
git add components/desktop/HomeDashboard.tsx app/(tabs)/(groups)/index.tsx
git commit -m "feat: add HomeDashboard with continue listening and recent retreats"
```

---

### Task 15: Add master-detail split to retreat view

On desktop, the retreat/[id].tsx screen splits into two panels: track list (master, 40%) and track detail (detail, 60%).

**Files:**
- Create: `components/desktop/TrackDetailPanel.tsx`
- Modify: `app/(tabs)/(groups)/retreat/[id].tsx`

**Step 1: Create TrackDetailPanel**

Shows info for the **selected** track:
- Track metadata: title, duration, teacher, language, original/translation
- Bookmarks list: timestamps with notes, clickable to seek
- Transcript access: "Open Transcript" button (navigates to transcript screen)

If no track is selected, shows the retreat overview (date range, place, teacher, total tracks/duration, download options).

**Step 2: Add selected track state to retreat screen**

Add `selectedTrack` state separate from `currentTrack` (playing track):
- Single-click a track → set selectedTrack (show in detail panel)
- Double-click a track → play it (update currentTrack via context) AND select it

```typescript
const [selectedTrack, setSelectedTrack] = useState<TrackWithSession | null>(null);
```

**Step 3: Split layout on desktop**

In the retreat screen's JSX, when `isDesktop`:

```typescript
const { isDesktop } = useDesktopLayout();

if (isDesktop) {
  return (
    <View style={desktopStyles.container}>
      {/* Header stays full-width */}
      <View style={desktopStyles.header}>...</View>

      {/* Master-Detail split */}
      <View style={desktopStyles.splitContainer}>
        {/* Master: Track list (40%) */}
        <ScrollView style={desktopStyles.masterPanel}>
          {/* Language toggle + tracks list — same as existing mobile content */}
        </ScrollView>

        {/* Detail: Track info (60%) */}
        <View style={desktopStyles.detailPanel}>
          <TrackDetailPanel
            track={selectedTrack}
            retreat={retreat}
            onSeekTo={(position) => audioContext.seekTo(position)}
          />
        </View>
      </View>
    </View>
  );
}

// ... existing mobile layout unchanged below ...
```

The split uses `flexDirection: 'row'` with `flex: 0.4` and `flex: 0.6`.

**Step 4: Test**

On desktop, navigate to a retreat. See the split layout. Click a track — detail panel updates. Double-click — playback starts and detail updates. On mobile — exact same behavior as before (no split).

**Step 5: Commit**

```bash
git add components/desktop/TrackDetailPanel.tsx app/(tabs)/(groups)/retreat/[id].tsx
git commit -m "feat: add master-detail split to retreat view on desktop"
```

---

### Task 16: Desktop-optimize group overview and settings screens

**Files:**
- Modify: `app/(tabs)/(groups)/[groupId].tsx`
- Modify: `app/(tabs)/settings.tsx`

**Step 1: Group overview — 2-column card grid**

In `[groupId].tsx`, when on desktop, render retreat cards in a 2-column grid instead of a single column.

Use `flexDirection: 'row', flexWrap: 'wrap'` with each card at `width: '48%'` (with gap).

**Step 2: Settings — centered max-width**

In `settings.tsx`, when on desktop, constrain the content width:

```typescript
const { isDesktop } = useDesktopLayout();

<ScrollView style={[styles.container, isDesktop && { maxWidth: 720, alignSelf: 'center', width: '100%' }]}>
```

**Step 3: Commit**

```bash
git add app/(tabs)/(groups)/[groupId].tsx app/(tabs)/settings.tsx
git commit -m "feat: desktop-optimize group overview and settings layouts"
```

---

## Phase 5: Expanded Player & Polish

### Task 17: Add expanded "Now Playing" panel to DesktopPlayerBar

**Files:**
- Modify: `components/desktop/DesktopPlayerBar.tsx`

**Step 1: Add expanded state**

Add `isExpanded` state. When the ∧ chevron is clicked, toggle to expanded mode.

Expanded mode:
- Height grows to ~60vh (animated slide-up, 300ms)
- Background overlay dims the main content (rgba(0,0,0,0.3))
- Left column: large artwork/mandala placeholder, full controls, progress slider, speed control, "Up Next" track queue
- Right column: track metadata, bookmarks, transcript preview

Collapse triggers: ∨ chevron, ✕ button, click on dimmed overlay, Escape key.

**Step 2: Test**

Click expand on the player bar. See the expanded panel with track info and queue. Click collapse. Verify animations are smooth.

**Step 3: Commit**

```bash
git add components/desktop/DesktopPlayerBar.tsx
git commit -m "feat: add expanded Now Playing panel to DesktopPlayerBar"
```

---

### Task 18: Add keyboard shortcuts

**Files:**
- Create: `hooks/useKeyboardShortcuts.ts`
- Modify: `components/desktop/DesktopShell.tsx` (activate the hook)

**Step 1: Create the hook**

Only activates on web (`Platform.OS === 'web'`). Listens for keydown events on `window`.

```typescript
// hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';

export function useKeyboardShortcuts() {
  const audio = useAudioPlayer();

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          audio.isPlaying ? audio.pause() : audio.resume();
          break;
        case 'ArrowLeft':
          if (e.shiftKey) audio.previousTrack();
          else audio.skipBackward();
          break;
        case 'ArrowRight':
          if (e.shiftKey) audio.nextTrack();
          else audio.skipForward();
          break;
        case 'Escape':
          // Collapse expanded player (handled via callback)
          break;
        case '[':
          audio.setPlaybackSpeed(Math.max(0.5, audio.playbackSpeed - 0.25));
          break;
        case ']':
          audio.setPlaybackSpeed(Math.min(2.0, audio.playbackSpeed + 0.25));
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [audio]);
}
```

**Step 2: Activate in DesktopShell**

Call `useKeyboardShortcuts()` inside the DesktopShell component.

**Step 3: Test**

Play a track. Press Space (pause/resume), arrow keys (seek), Shift+arrows (next/prev track), brackets (speed).

**Step 4: Commit**

```bash
git add hooks/useKeyboardShortcuts.ts components/desktop/DesktopShell.tsx
git commit -m "feat: add keyboard shortcuts for desktop audio playback"
```

---

### Task 19: Add tablet collapsed sidebar mode

**Files:**
- Modify: `components/desktop/Sidebar.tsx`

**Step 1: Collapsed rail mode**

When `sidebarCollapsed` is true (768-1024px), render a narrow 64px rail with:
- Logo icon (☸) at top
- Nav item icons (no labels)
- Group initials or icons
- User avatar at bottom

**Step 2: Hover/click expansion**

On hover or click, expand the sidebar as an overlay (position: absolute, z-index above content). Click away collapses it.

Use a `hovered` state and web `onMouseEnter`/`onMouseLeave` events.

**Step 3: Test**

Resize browser to 768-1024px. See collapsed rail. Hover to expand. Click away to collapse.

**Step 4: Commit**

```bash
git add components/desktop/Sidebar.tsx
git commit -m "feat: add collapsed sidebar rail for tablet viewports"
```

---

### Task 20: Add localization strings for desktop UI

**Files:**
- Modify: `locales/en.json`
- Modify: `locales/pt.json`

**Step 1: Add new keys**

```json
{
  "desktop": {
    "home": "Home",
    "yourGroups": "Your Groups",
    "continuListening": "Continue Listening",
    "recentRetreats": "Recent Retreats",
    "remaining": "{{time}} remaining",
    "complete": "Complete",
    "progress": "{{percent}}% listened",
    "nowPlaying": "Now Playing",
    "upNext": "Up Next",
    "openTranscript": "Open Transcript",
    "trackInfo": "Track Info",
    "noTrackSelected": "Select a track to see details",
    "greeting": {
      "morning": "Good morning",
      "afternoon": "Good afternoon",
      "evening": "Good evening"
    }
  }
}
```

Add Portuguese equivalents in `pt.json`.

**Step 2: Commit**

```bash
git add locales/en.json locales/pt.json
git commit -m "feat: add localization strings for desktop UI"
```

---

### Task 21: Final integration testing and cleanup

**Step 1: Full flow test on web desktop (>1025px)**

1. Load app → see sidebar with groups + home dashboard
2. Click a group in sidebar → sidebar drills to retreats, main shows group overview
3. Click a retreat → sidebar drills to sessions, main shows tracks (master-detail)
4. Click a track → detail panel shows info
5. Double-click a track → playback starts, desktop player bar appears
6. Navigate to Settings → player bar persists, playback continues
7. Navigate back to retreat → same track still playing
8. Test keyboard shortcuts (Space, arrows, etc.)
9. Click expand on player bar → expanded Now Playing panel
10. Test breadcrumb navigation in sidebar

**Step 2: Full flow test on web tablet (768-1024px)**

1. Collapsed sidebar rail visible
2. Hover to expand
3. Same navigation works
4. No master-detail split (single panel)

**Step 3: Full flow test on mobile**

1. Everything exactly as before — no regressions
2. Bottom tab bar, inline player, stack navigation

**Step 4: Cleanup**

- Remove any console.log statements added during development
- Ensure no TypeScript errors: `npx tsc --noEmit`
- Run lint: `npx expo lint`

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete desktop layout with sidebar, player bar, and master-detail"
```

---

## File Summary

### New files (11)
- `hooks/useDesktopLayout.ts`
- `hooks/useKeyboardShortcuts.ts`
- `constants/colors.ts`
- `contexts/AudioPlayerContext.tsx`
- `contexts/SidebarNavigationContext.tsx`
- `components/desktop/DesktopShell.tsx`
- `components/desktop/Sidebar.tsx`
- `components/desktop/DesktopPlayerBar.tsx`
- `components/desktop/HomeDashboard.tsx`
- `components/desktop/TrackDetailPanel.tsx`
- `docs/plans/2026-02-21-desktop-layout-plan.md` (this file)

### Modified files (7)
- `app/_layout.tsx` (add AudioPlayerProvider)
- `app/(tabs)/_layout.tsx` (wrap in DesktopShell, hide tab bar)
- `app/(tabs)/(groups)/index.tsx` (render HomeDashboard on desktop)
- `app/(tabs)/(groups)/[groupId].tsx` (2-column grid on desktop)
- `app/(tabs)/(groups)/retreat/[id].tsx` (master-detail split, use audio context)
- `app/(tabs)/settings.tsx` (centered max-width on desktop)
- `components/ui/AppHeader.tsx` (hide on desktop)
- `components/AudioPlayer.tsx` (consume from AudioPlayerContext)
- `locales/en.json` + `locales/pt.json` (new desktop strings)

### Unchanged
- All mobile layouts
- Authentication screens
- PDF viewer
- All services (API, download, cache, auth)
- All types
