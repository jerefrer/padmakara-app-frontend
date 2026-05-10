# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Server Management
- **DO NOT** start or stop servers yourself (backend, npm start, etc.)
- User will manage all servers
- If you need to check server logs or status, ASK the user first

## Project Overview

This is a Padmakara Buddhist learning app built with React Native and Expo Router for the Tibetan Buddhist community. The app provides access to recordings and transcripts from Buddhist retreats across multiple platforms (web, iOS, Android, with future support for Windows, macOS, Linux).

### Core Purpose
- Enable Buddhist practitioners to access retreat recordings and transcripts offline and online
- Support community members who belong to retreat groups that gather twice yearly (spring/fall)
- Provide secure, private access to sensitive spiritual content
- Serve users primarily 40+ with simple, elegant, and accessible interface

### Content Structure
- **Retreat Groups**: Communities that practitioners belong to (users can belong to multiple groups)
- **Gatherings**: Bi-annual meetings (spring/fall) lasting several days
- **Sessions**: Daily recordings (typically morning/evening)
- **Tracks**: Individual audio segments from sessions
- **Transcripts**: PDF files accompanying audio content

## Development Commands

### Primary Commands
- `npm start` or `expo start` - Start the development server with Metro bundler
- `npm run android` - Run on Android emulator/device  
- `npm run ios` - Run on iOS simulator/device
- `npm run web` - Run web version
- `npm run lint` - Run ESLint for code quality checks
- `npm test` - Run the Jest test suite (unit + context integration)
- `npm run test:watch` - Run Jest in watch mode

### Platform-Specific
- `expo start --android` - Start with Android focus
- `expo start --ios` - Start with iOS focus  
- `expo start --web` - Start web version
- `npm run reset-project` - Reset to clean starter template

## Architecture & Structure

### Testing
- **Framework:** Jest + jest-expo preset (Expo SDK 54).
- **Layers:** pure utilities (`utils/trackFiltering.test.ts`), services (`services/progressService.test.ts`), and context integration (`contexts/AudioPlayerContext.test.tsx`).
- **Mocks:** custom `expo-audio` mock at `__mocks__/expo-audio.ts` (hook-shaped, with test-only `__advanceTime`/`__finishTrack`/`__setDuration` helpers); AsyncStorage uses the package's built-in jest mock.
- **What's NOT tested:** `<AudioPlayer />` button rendering, screen-level integration.
- **Spec/plan:** `docs/superpowers/specs/2026-05-08-audio-player-resume-tests-design.md` and `docs/superpowers/plans/2026-05-08-audio-player-resume-tests.md`.

### Cross-Device Sync (audio progress)
- **Push:** every local `saveProgress` (10s cadence + on pause + on track-switch + on completion) fires `POST /api/content/progress` fire-and-forget. Throttled by the existing local cadence; no extra rate-limit needed.
- **Pull:** **bulk only**, at session boundaries — runs once on cold start and on background→foreground transitions throttled to ≥5 minutes since the last pull. The bulk pull does both directions: pulls all server rows, merges by `lastPlayed`, and pushes any local-newer rows back. Per-track pulls on track click were removed because they caused slider jitter and added per-tap network traffic; the cache populated by the bulk pull is authoritative within a session.
- **Last-played track** also pulled at the same cold-start + foreground-throttled boundaries via `GET /api/content/last-played`.
- **Conflict resolution:** last-write-wins by `lastPlayed` timestamp.
- **Offline:** silent catches everywhere. Local saves always succeed. Next push on reconnect carries the latest position.
- **Track click is purely local & instant.** `playTrack` synchronously pre-sets `phase='loading'` and `targetPosition` from the in-memory cache before `setTrack`, so the first render under the new track id is already at the right position (no flash of the previous track's livePosition).
- **Spec/plan:**
  - `docs/superpowers/specs/2026-05-09-cross-device-audio-progress-sync-design.md` (original)
  - `docs/superpowers/plans/2026-05-10-audio-sync-simplification.md` (refactor that replaced per-track pull with bulk sync)

### Routing System
- Uses **Expo Router v5** with file-based routing and typed routes
- Root entry point: `app/index.tsx` (authentication guard)

### Navigation Flow (IMPORTANT!)

**Tab bar is visible throughout the app** thanks to nested Stack navigation inside tabs.

**Main User Flow:**
```
(tabs)/(groups)/index.tsx (Home)         →  Home screen (categories, featured, recently added)
        ↓ tap "Teachings & Talks"
(tabs)/(groups)/events.tsx              →  Public events list (re-exports (events)/index)
        ↓ tap event
(tabs)/(groups)/retreat/[id].tsx        →  Sessions list for an event
        ↓ tap "Retreats"
(tabs)/(groups)/retreats-list.tsx       →  Retreat groups list (auth required)
        ↓ tap group
(tabs)/(groups)/[groupId].tsx           →  Events for that group
        ↓ tap event
(tabs)/(groups)/retreat/[id].tsx        →  Sessions list
        ↓ tap session
(tabs)/(groups)/session/[id].tsx        →  Tracks with audio player
        ↓ tap transcript
(tabs)/(groups)/transcript/[id].tsx     →  PDF transcript viewer
```

### Active Screens (Used in Navigation)
| File | Purpose | Navigation From |
|------|---------|-----------------|
| `(tabs)/(groups)/index.tsx` | Home screen (categories, featured event, recently added) | Tab bar (Home tab) |
| `(tabs)/(groups)/events.tsx` | Public events list (re-exports `(events)/index`) | Home → "Teachings & Talks" |
| `(tabs)/(groups)/retreats-list.tsx` | Retreat groups list (auth required) | Home → "Retreats" |
| `(tabs)/(groups)/[groupId].tsx` | Events for a retreat group | Retreats list |
| `(tabs)/(groups)/retreat/[id].tsx` | Sessions list for an event | Events list or home featured/recent |
| `(tabs)/(groups)/session/[id].tsx` | Tracks with audio player | Sessions list |
| `(tabs)/(groups)/transcript/[id].tsx` | PDF transcript viewer | Track actions |
| `(tabs)/settings.tsx` | Settings | Tab bar (Settings tab) |

**IMPORTANT — Navigation within Home tab:** All navigation from the home screen (Teachings & Talks, Retreats, featured event, recently added events) must stay within the `(groups)` stack. Never navigate to a different tab like `(events)` — this causes the app to open on the wrong screen when resumed from background.

### Terminology Clarification
**IMPORTANT:** The codebase uses "Gathering" and "Retreat" interchangeably:
- **In Types/API**: Uses `Gathering` interface
- **In UI/Routes**: Uses "retreat" terminology (e.g., `retreat/[id].tsx`)
- **In `[groupId].tsx`**: Shows `Gathering` objects but calls them "retreats" in the UI

When editing retreat-related code:
- **To modify the retreats LIST**: Edit `(tabs)/(groups)/[groupId].tsx`
- **To modify retreat DETAIL page**: Edit `(tabs)/(groups)/retreat/[id].tsx`

### App Directory Structure
```
app/
├── (auth)/                 # Authentication flow (unauthenticated)
│   ├── _layout.tsx
│   ├── magic-link.tsx      # Magic link authentication
│   ├── check-email.tsx     # Email verification prompt
│   ├── approval-pending.tsx # Account approval waiting
│   └── device-activated.tsx # Device activation success
├── (tabs)/                 # Main app (authenticated, tab navigation)
│   ├── _layout.tsx         # Tab bar configuration (Groups + Settings tabs)
│   ├── (groups)/           # Stack navigator for Home tab content
│   │   ├── _layout.tsx     # Stack configuration
│   │   ├── index.tsx       # Home screen (categories, featured, recently added)
│   │   ├── events.tsx      # Public events list (re-exports (events)/index)
│   │   ├── retreats-list.tsx   # Retreat groups list (auth required)
│   │   ├── [groupId].tsx   # Events for a retreat group
│   │   ├── retreat/[id].tsx    # Sessions list for an event
│   │   ├── session/[id].tsx    # Tracks with audio player
│   │   └── transcript/[id].tsx # PDF transcript viewer
│   └── settings.tsx        # Settings tab (formerly profile)
├── _layout.tsx             # Root layout with providers
├── index.tsx               # Auth guard/entry point
└── +not-found.tsx          # 404 page
```

### Global Providers (app/_layout.tsx)
1. **AuthProvider** - Authentication state management
2. **LanguageProvider** - Internationalization (English/Portuguese)

### Context Architecture
- **AuthContext** (`contexts/AuthContext.tsx`) - Complete authentication with biometric support
- **LanguageContext** (`contexts/LanguageContext.tsx`) - UI and content language management

### Key Components
- **AudioPlayer** (`components/AudioPlayer.tsx`) - Core audio playback with progress tracking
- **PDFViewer** (`components/PDFViewer.tsx`) - Transcript viewing with highlights
- **BookmarksManager** (`components/BookmarksManager.tsx`) - User bookmark functionality
- **UI Components** (`components/ui/`) - Reusable interface elements

### Data Types
Located in `types/index.ts`:
- **User** - User accounts with preferences and subscription status
- **RetreatGroup/Gathering/Session/Track** - Content hierarchy structure  
- **UserProgress/Bookmark** - Learning progress and annotations
- **DownloadedContent** - Offline content management

### Services
- **apiConfig** (`services/apiConfig.ts`) - API base URL and endpoint definitions
- **authService** (`services/authService.ts`) - Authentication operations including biometric
- **retreatService** (`services/retreatService.ts`) - Events, sessions, tracks, public/featured events
- **progressService** (`services/progressService.ts`) - User progress tracking

### Styling System
- **React Native StyleSheet** — inline `StyleSheet.create()` per component
- **Color palette**: Burgundy (#9b1b1b), white backgrounds, gray scale
- **Typography**: EBGaramond serif font with `fontVariant: ['small-caps']` for headings
- **Accessibility-focused**: Larger font sizes for 40+ demographic
- **Design philosophy**: Warm, elegant, minimal — Buddhist-inspired aesthetic
- **Light theme only**: No dark mode implementation

### Internationalization
- **Multi-language UI**: Designed for easy addition of new languages (currently English/Portuguese)
- **Content Language Options**: 
  - English only
  - English + Portuguese (bilingual)
  - Users can switch between options at any time
- **Implementation**: `utils/i18n.ts` with separate UI and content language management
- **Language files**: `locales/en.json`, `locales/pt.json` (extensible for other languages)

### Audio Content Structure
Sample audio files organized in `samples/` directory by retreat dates with bilingual naming convention (ENG/POR versions).

### Offline Functionality
- **Download Management**: Audio and PDF files downloadable for offline access
- **Progress Persistence**: App remembers playback position for every audio file
- **Bookmark Support**: Users can create bookmarks within audio tracks
- **Sync Capability**: Progress and bookmarks sync across devices (when online)

## Development Guidelines

### TypeScript Configuration
- Strict mode enabled
- Path aliases: `@/*` maps to project root
- Expo TypeScript base configuration

### Code Style
- ESLint with Expo configuration
- Flat config structure for ESLint 9+

### Platform Support
- **Current**: iOS, Android, and Web support
- **Future**: Windows, macOS, Linux compatibility planned
- **Responsive Design**: Mobile looks like mobile app, desktop like desktop app (not scaled mobile)
- **Device Optimization**: Uses all available screen space appropriately
- **Technical**: New Architecture enabled for React Native, edge-to-edge on Android, tablet support on iOS

### Key Dependencies
- **Expo SDK 53** with Router, AV, File System, Local Authentication
- **React Native 0.79** with React 19
- **expo-router v5** — file-based routing with typed routes
- **expo-image** — optimized image loading
- **expo-av** — audio playback
- **react-native-safe-area-context** — safe area insets
- **Storage**: AsyncStorage for local data

## Common Development Tasks

### Authentication & Security
The app starts with an authentication guard at `app/index.tsx` that redirects to `/(tabs)/(groups)` for authenticated users or `/(auth)/magic-link` for guests. Public content (featured event, recently added) is visible without authentication.

**Security Requirements:**
- **Private Content**: Highly sensitive spiritual content requires secure access
- **Biometric Authentication**: Preferred login method for ease and security
- **Simple UX**: One-time login experience optimized for 40+ users
- **Group-based Access**: Users only see content for their authorized retreat groups

### Adding New Routes
Create files in the `app/` directory following Expo Router conventions. Dynamic routes use square brackets `[id].tsx`.

### Styling Components
Use `StyleSheet.create()` with the burgundy/white/gray color palette and EBGaramond font for headings.

### Working with Audio
Use the `AudioPlayer` component for consistent playback experience with progress tracking and bookmark support.

### PDF Transcript Management  
- **Built-in PDF Reader**: Transcripts viewable directly within app
- **Highlighting Support**: Basic highlighting functionality for study
- **Reading Progress**: Remembers last read position
- **Integration**: Seamless connection between audio tracks and corresponding transcripts

### Language/Content Management
Access translation functions via `useLanguage()` hook. UI language and content language are managed separately.

## Backend Integration

### Current State
- **Backend**: Hono + Drizzle ORM + Bun runtime (in `padmakara-api/`)
- **Production**: `https://api.padmakara.pt/api`
- **Local development**: `http://localhost:3000/api`
- **API Configuration**: `services/apiConfig.ts` reads `EXPO_PUBLIC_API_URL` from `.env`

### Server Configuration
The `.env` file controls which backend the app connects to via `EXPO_PUBLIC_API_URL`:

```bash
# Production (default in committed .env):
EXPO_PUBLIC_API_URL=https://api.padmakara.pt/api

# Local development:
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

**NOTE:** The old `EXPO_PUBLIC_USE_LOCAL_BACKEND` env var is no longer used. Change `EXPO_PUBLIC_API_URL` directly.

### Environment Setup
1. **Production Mode**: Set `EXPO_PUBLIC_API_URL=https://api.padmakara.pt/api` in `.env`
2. **Local Development Mode**:
   - Set `EXPO_PUBLIC_API_URL=http://localhost:3000/api` in `.env`
   - Start backend: `cd padmakara-api && bun run dev`
   - Start app: `npx expo start --clear` (clear cache after env change)
3. **Backend Features**: PostgreSQL database, S3 file storage, JWT authentication, ZIP download generation

### Visual Assets
- **Logo**: Use `assets/images/logo.png` for app branding
- **Color Scheme Reference**: `docs/screenshot.jpeg` provides visual style guide
- **Animation Guidelines**: Implement subtle animations throughout for enhanced UX