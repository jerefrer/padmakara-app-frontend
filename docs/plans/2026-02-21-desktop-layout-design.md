# Desktop Layout Design — Padmakara App

**Date:** 2026-02-21
**Status:** Approved
**Platform:** Web-first responsive, potentially wrappable in Electron/Tauri later

## Overview

Transform the Padmakara web/desktop experience from a stretched mobile layout into a proper desktop application following the "Spotify Model" — left sidebar navigation, master-detail content area, and persistent bottom player bar.

Mobile layouts remain completely unchanged. The desktop shell activates only on web platform above 768px viewport width.

## Architecture

### Layout Shell (CSS Grid)

```
┌──────────────┬─────────────────────────────────────────┐
│  SIDEBAR     │  MAIN CONTENT AREA                      │
│  (240px)     │  (flex, master-detail on session view)   │
│              │                                          │
│              │                                          │
│              │                                          │
├──────────────┴─────────────────────────────────────────┤
│  PLAYER BAR (80px, full-width, expandable to ~60vh)    │
└────────────────────────────────────────────────────────┘

Grid: grid-rows-[1fr_80px] grid-cols-[240px_1fr] h-screen
```

### Breakpoints

| Breakpoint | Width | Sidebar | Main Content | Player |
|-----------|-------|---------|--------------|--------|
| Mobile | < 768px | Hidden (bottom tabs) | Current layout | Inline in session |
| Tablet | 768–1024px | Collapsed rail (64px) | Single panel | Bottom bar (80px) |
| Desktop | 1025–1440px | Full (240px) | Single or master-detail | Bottom bar (80px) |
| Wide | > 1440px | Full (240px) | Max-width 1200px, centered | Bottom bar (80px) |

### Detection Hook

```typescript
// useDesktopLayout()
const isWeb = Platform.OS === 'web';
const { width } = useWindowDimensions();

return {
  isMobile: !isWeb || width < 768,
  isTablet: isWeb && width >= 768 && width < 1025,
  isDesktop: isWeb && width >= 1025,
  isWide: isWeb && width > 1440,
  showSidebar: isWeb && width >= 768,
  showMasterDetail: isWeb && width >= 1025,
  sidebarCollapsed: isWeb && width >= 768 && width < 1025,
};
```

## Section 1: Left Sidebar

### Structure

```
┌─ SIDEBAR (240px) ────────────────┐
│  ☸ Padmakara              [«]    │  Logo + collapse toggle
│                                   │
│  🏠  Home                         │  Fixed nav (always visible)
│  📅  Events                       │
│  ⚙️  Settings                     │
│  💳  Subscription    (web only)   │
│                                   │
│  ─────────────────────────────    │
│                                   │
│  YOUR GROUPS                      │  Section header
│  ▸ Mahamudra Practice Group       │  Swappable content list
│  ▸ Dzogchen Study Circle          │
│  ▸ Ngöndro Retreat Group          │
│                                   │
│  ─────────────────────────────    │
│  👤 Jeremy · Subscriber           │  User footer
└───────────────────────────────────┘
```

### Breadcrumb Drill-Down

Content list swaps with slide-left animation when drilling into hierarchy.

**Level 0 — Groups:**
```
YOUR GROUPS
▸ Mahamudra Practice Group
▸ Dzogchen Study Circle
```

**Level 1 — Retreats (after clicking group):**
```
← Your Groups
MAHAMUDRA PRACTICE GROUP

2024
▸ Fall Retreat · Oct 12-15
▸ Spring Retreat · Apr 5-8

2023
▸ Fall Retreat · Oct 20-23
```

**Level 2 — Sessions (after clicking retreat):**
```
← Mahamudra Practice Group
FALL RETREAT · OCT 12-15

Day 1 · Oct 12 · Morning
Day 1 · Oct 12 · Evening
Day 2 · Oct 13 · Morning
```

Clicking a session at Level 2 loads tracks into the main content master-detail panel. Sidebar stays at Level 2 so users can switch sessions quickly.

### Sidebar State Behavior

| Action | Sidebar | Main Content |
|--------|---------|-------------|
| Home clicked | Level 0 (groups) | Dashboard |
| Events clicked | Unchanged | Events page |
| Settings clicked | Unchanged | Settings page |
| Group clicked | Drills to Level 1 | Group overview |
| Retreat clicked | Drills to Level 2 | Retreat overview |
| Session clicked | Stays Level 2, highlights active | Master-detail track view |

### Tablet Mode (768-1024px)

Collapses to 64px icon rail. Hover/click expands as overlay without pushing content.

```
┌──────┐
│  ☸   │  Logo icon
│  🏠  │
│  📅  │
│  ⚙️  │
│ ──── │
│  M   │  Group initials
│  D   │
│ ──── │
│  👤  │
└──────┘
```

### Visual Styling

- Background: White (#ffffff), right border (#e5e7eb)
- Active nav: Cream (#fcf8f3) background, 3px burgundy left accent
- Hover: Light cream (#fefdfb)
- Section headers: Gray-500 (#6b7280), 11px, uppercase, 0.05em letter-spacing
- List items: 14px, 500 weight, gray-800. Burgundy when active.
- Breadcrumb: 13px, burgundy, ← arrow. Hover: underline.
- User footer: Top border, 13px, 28px circle avatar

## Section 2: Main Content Area

### Screen: Home Dashboard

Full-width panel with "Continue Listening" card and recent retreat grid.

```
Good morning, Jeremy

CONTINUE LISTENING
▶ Track 3 · Day 2 Morning · Fall Retreat 2024
  Mahamudra Practice Group · 12:34 remaining

RECENT RETREATS
┌────────────┐  ┌────────────┐  ┌────────────┐
│ Fall 2024  │  │ Spring '24 │  │ Fall 2023  │
│ Mahamudra  │  │ Dzogchen   │  │ Mahamudra  │
│ 80% done   │  │ Complete ✓ │  │ 45% done   │
└────────────┘  └────────────┘  └────────────┘
```

### Screen: Group Overview

Full-width panel. 2-column card grid showing retreats by year with progress bars.

### Screen: Session View — Master-Detail Split

Core listening experience. Only activates on desktop (>1025px).

```
┌─ MASTER (40%) ──────────────┬─ DETAIL (60%) ─────────────────────┐
│                              │                                     │
│  🔉 English + Portuguese    │  ▶ Track 2 · Day 1 Morning         │
│                              │  Duration: 45:22                   │
│  DAY 1 · OCT 12 · MORNING   │  Teacher: Rinpoche                 │
│  ┌────────────────────────┐  │  Language: English (Original)      │
│  │ 🔊 Track 1     32:10  │  │                                     │
│  ├────────────────────────┤  │  BOOKMARKS                         │
│  │ ▶  Track 2     45:22  │◄─│  📌 12:34 — "Key point..."        │
│  ├────────────────────────┤  │  📌 28:10 — "Practice..."         │
│  │    Track 3     28:55  │  │                                     │
│  ├────────────────────────┤  │  TRANSCRIPT                         │
│  │ 🇵🇹 Track 2 PT  45:22 │  │  [PDF preview / Open button]       │
│  └────────────────────────┘  │                                     │
└──────────────────────────────┴─────────────────────────────────────┘
```

**Interaction model:**
- Single-click: select track → show detail in right panel
- Double-click: start playback → update bottom player bar
- Playing track: animated bars icon in master list
- Selected track: cream background highlight

### Screen: Settings

Full-width, max-width 720px, centered. Same content as mobile with better spacing.

### Screen: Transcript (full view)

Opens as full main-area overlay. Back button returns to session view.

## Section 3: Bottom Player Bar

### Compact Mode (80px)

```
┌─────────────────────────────────────────────────────────────────────┐
│  LEFT: Track info        CENTER: Transport + progress    RIGHT:    │
│  - Playing bars          - ↺15  ◄◄  ▶/❚❚  ►►  15↻      - Speed   │
│  - Track title           - Progress slider               - 🔖 📄  │
│  - Group · Teacher                                       - ∧       │
└─────────────────────────────────────────────────────────────────────┘
```

- Background: White, top border (#e5e7eb), upward shadow
- Play button: 36px, burgundy filled circle
- Transport icons: 24px, gray-600
- Progress slider: burgundy track, gray-300 remaining
- Track title: clickable (navigates to session)
- Hidden when no track is playing (appears with slide-up animation)

### Expanded Mode ("Now Playing" — ~60vh)

Clicking ∧ chevron expands upward. Background dims to rgba(0,0,0,0.3).

```
┌─────────────────────────────────────────────────────────────────────┐
│  ∨  NOW PLAYING                                               ✕    │
│                                                                     │
│  LEFT (40%):                    RIGHT (60%):                       │
│  - Large artwork / mandala      - Track metadata                   │
│  - Full transport controls      - Bookmarks (clickable, editable)  │
│  - Progress slider              - Transcript preview               │
│  - Speed, bookmark, transcript  -                                  │
│  - "Up Next" queue                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Animations:**
- Expand: slide up ~300ms, ease-out
- Collapse: click ∨, ✕, or dimmed background

## Section 4: Keyboard Shortcuts (Desktop Only)

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| ← | Rewind 15s |
| → | Forward 15s |
| Shift+← | Previous track |
| Shift+→ | Next track |
| Escape | Collapse player / close modal |
| [ | Decrease speed |
| ] | Increase speed |
| B | Add bookmark |

## Section 5: What Changes vs. What's Reused

### Reused (zero changes)
- All mobile layouts when `isMobile: true`
- Authentication flow screens
- PDF viewer component
- Audio playback logic and state machine
- All API/data fetching
- Localization system
- Biometric auth, storage management

### New Components (desktop only)
- `DesktopShell` — grid container
- `Sidebar` — nav, breadcrumb list, user footer
- `DesktopPlayerBar` — compact + expandable
- `MasterDetailLayout` — split panel wrapper
- `TrackDetailPanel` — bookmarks/transcript detail
- `HomeDashboard` — continue listening + recents

### Adapted Components (conditional rendering)
- `(tabs)/_layout.tsx` — switches between `<Tabs>` (mobile) and `<DesktopShell>` (desktop)
- Group/retreat cards — grid on desktop, list on mobile
- `AppHeader` — hidden on desktop (sidebar replaces it)

## Visual Design Reference

### Color Palette (unchanged from mobile)
- Burgundy primary: #b91c1c
- Cream background: #fcf8f3
- Saffron accent: #f59e0b
- White cards: #ffffff
- Gray text: #6b7280
- Borders: #e5e7eb

### Desktop-Specific Styling
- Sidebar: White bg, right border
- Active sidebar item: Cream bg, 3px burgundy left accent
- Player bar: White bg, top border, upward shadow
- Master-detail divider: 1px vertical #e5e7eb
- Card grid: 2-column on desktop, 3-column on wide
- Max content width: 1200px (centered on > 1440px screens)
