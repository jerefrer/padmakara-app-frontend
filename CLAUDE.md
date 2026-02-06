# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Server Management
- **DO NOT** start or stop servers yourself (Django backend, npm start, etc.)
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

### Platform-Specific
- `expo start --android` - Start with Android focus
- `expo start --ios` - Start with iOS focus  
- `expo start --web` - Start web version
- `npm run reset-project` - Reset to clean starter template

## Architecture & Structure

### Routing System
- Uses **Expo Router v5** with file-based routing and typed routes
- Root entry point: `app/index.tsx` (authentication guard)

### Navigation Flow (IMPORTANT!)

**Tab bar is visible throughout the app** thanks to nested Stack navigation inside tabs.

**Main User Flow:**
```
(tabs)/(groups)/index.tsx (Groups Tab)  →  Shows list of RetreatGroups
        ↓ tap group
(tabs)/(groups)/[groupId].tsx           →  Shows list of Retreats for that group
        ↓ tap retreat
(tabs)/(groups)/retreat/[id].tsx        →  Shows list of Sessions
        ↓ tap session
(tabs)/(groups)/session/[id].tsx        →  Shows tracks with audio player
        ↓ tap transcript
(tabs)/(groups)/transcript/[id].tsx     →  PDF transcript viewer
```

### Active Screens (Used in Navigation)
| File | Purpose | Navigation From |
|------|---------|-----------------|
| `(tabs)/(groups)/index.tsx` | Home/Groups list | Tab bar (Groups tab) |
| `(tabs)/settings.tsx` | Settings (formerly Profile) | Tab bar (Settings tab) |
| `(tabs)/(groups)/[groupId].tsx` | **Retreats list for a group** | Groups list |
| `(tabs)/(groups)/retreat/[id].tsx` | Sessions list | Retreats list |
| `(tabs)/(groups)/session/[id].tsx` | Tracks with audio player | Sessions list |
| `(tabs)/(groups)/transcript/[id].tsx` | PDF transcript viewer | Track actions |

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
│   ├── (groups)/           # Stack navigator for Groups tab content
│   │   ├── _layout.tsx     # Stack configuration
│   │   ├── index.tsx       # Groups list (home)
│   │   ├── [groupId].tsx   # Retreats list for a group
│   │   ├── retreat/[id].tsx    # Sessions list
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
- **authService** (`services/authService.ts`) - Authentication operations including biometric
- **progressService** (`services/progressService.ts`) - User progress tracking

### Styling System
- **NativeWind v4** - Tailwind CSS for React Native
- **Custom Theme** (`tailwind.config.js`):
  - **Tibetan Buddhist color palette**: burgundy red (#b91c1c), saffron yellow (#f59e0b), light cream (#e8d8b7)
  - **Accessibility-focused design**: Larger font sizes for 40+ demographic (14-30px range)
  - **Typography**: Inter (sans-serif), Georgia (serif)
  - **Design philosophy**: Warm, elegant, practical, and respectful aesthetic
  - **Visual reference**: Based on existing website design (docs/screenshot.jpeg)
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
- **NativeWind 4** for styling  
- **React Navigation 7** (tabs/stack)
- **Audio/PDF libraries**: react-native-pdf, expo-av
- **Storage**: AsyncStorage for local data

## Common Development Tasks

### Authentication & Security
The app starts with an authentication guard at `app/index.tsx` that redirects to either `/(tabs)` for authenticated users or `/(auth)/login` for guests.

**Security Requirements:**
- **Private Content**: Highly sensitive spiritual content requires secure access
- **Biometric Authentication**: Preferred login method for ease and security
- **Simple UX**: One-time login experience optimized for 40+ users
- **Group-based Access**: Users only see content for their authorized retreat groups

### Adding New Routes
Create files in the `app/` directory following Expo Router conventions. Dynamic routes use square brackets `[id].tsx`.

### Styling Components  
Use NativeWind classes with the custom color palette (cream, burgundy, saffron) and larger font sizes for accessibility.

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
- **Production Backend**: App now connects to production Django server by default (212.227.131.117)
- **Local Development Override**: Option to use local Django backend when needed
- **API Configuration**: Located in `services/apiConfig.ts` with environment-based switching

### Server Configuration
**Default (Production):**
```typescript
// Uses production server: http://212.227.131.117/api
```

**Local Development Override:**
```bash
# Create .env file with:
EXPO_PUBLIC_USE_LOCAL_BACKEND=true
# This switches to: http://localhost:8000/api
```

### Environment Setup
1. **Production Mode (Default)**: No configuration needed - uses production server
2. **Local Development Mode**: 
   - Copy `.env.example` to `.env`
   - Set `EXPO_PUBLIC_USE_LOCAL_BACKEND=true`
   - Ensure Django backend is running on `localhost:8000`
3. **Backend Features**: PostgreSQL database, S3 file storage, JWT authentication, ZIP download generation

### Visual Assets
- **Logo**: Use `assets/images/logo.png` for app branding
- **Color Scheme Reference**: `docs/screenshot.jpeg` provides visual style guide
- **Animation Guidelines**: Implement subtle animations throughout for enhanced UX