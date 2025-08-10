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
- Main structure:
  - `app/(tabs)/` - Protected main app with tab navigation (Home, Retreats, Downloads, Profile)
  - `app/(auth)/` - Authentication flow (Login, Signup)  
  - `app/gathering/[id].tsx` - Dynamic gathering detail pages
  - `app/transcript/[id].tsx` - Dynamic transcript viewer pages

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

## Backend Integration (Future)

### Current State
- **Mock Data**: Currently using sample files and mock authentication
- **AWS S3 Storage**: Audio and PDF files will be served from Amazon S3
- **Authentication Strategy**: Plan to use AWS platform for user authentication and content authorization

### Implementation Approach
- **Delayed AWS Integration**: Focus on frontend development first
- **Step-by-step Backend Connection**: Gradual migration from mock to real backend
- **Admin Panel Consideration**: May implement if AWS-only approach becomes too complex
- **Content Security**: Group-based access control to restrict users to authorized content only

### Visual Assets
- **Logo**: Use `assets/images/logo.png` for app branding
- **Color Scheme Reference**: `docs/screenshot.jpeg` provides visual style guide
- **Animation Guidelines**: Implement subtle animations throughout for enhanced UX