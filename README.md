# Padmakara App

A cross-platform mobile app for Buddhist practitioners to access retreat recordings and transcripts from Jigme Khyentse Rinpoche's teachings on mind training and the 37 practices of bodhisattvas.

## Get Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Run on specific platforms:
   ```bash
   npm run ios      # iOS simulator
   npm run android  # Android emulator
   npm run web      # Web browser
   ```

## Project Structure

```
app/
├── (auth)/                 # Authentication flow
│   ├── magic-link.tsx      # Magic link authentication
│   ├── check-email.tsx     # Email verification prompt
│   ├── approval-pending.tsx # Account approval waiting
│   └── device-activated.tsx # Device activation success
├── (tabs)/                 # Main app (tab navigation)
│   ├── index.tsx           # Home - Groups list
│   └── profile.tsx         # User profile
├── group/[id].tsx          # Group detail → Retreats list
├── retreat/[id].tsx        # Retreat detail → Sessions list
├── session/[id].tsx        # Session → Audio player
├── transcript/[id].tsx     # PDF transcript viewer
└── +not-found.tsx          # 404 page

components/
├── AudioPlayer.tsx         # Audio playback with progress tracking
├── PDFViewer.tsx           # Cross-platform PDF viewer
├── BookmarksManager.tsx    # Bookmark management
├── OfflineBadge.tsx        # Offline availability indicator
└── ui/                     # UI components

contexts/
├── AuthContext.tsx         # Authentication state
└── LanguageContext.tsx     # i18n support (English/Portuguese)

services/
├── authService.ts          # Authentication API
├── retreatService.ts       # Retreat data API
├── downloadService.ts      # Offline downloads
└── apiService.ts           # Base API client
```

## Navigation Flow

```
Groups (Home) → Group Detail → Retreat → Session → Transcript
     ↓              ↓            ↓          ↓
  Profile      Retreats      Sessions    Audio + PDF
```

## Features

### Audio Player
- Progress tracking with resume from where you left off
- Playback speed control (0.5x to 2x)
- Bookmark system with notes
- Cross-platform support

### PDF Transcript Viewer
- View transcripts alongside audio
- Text highlighting
- Progress synchronization

### Offline Support
- Download retreats for offline listening
- Progress saved locally and synced when online

### Authentication
- Magic link email authentication
- Biometric support (Face ID / Touch ID)
- Group-based content access

### Multi-language
- Interface: English and Portuguese
- Content: English-only or English+Portuguese

## Technical Stack

- **Framework**: Expo 53 with React Native 0.79
- **Navigation**: Expo Router with file-based routing
- **State**: React Context
- **Audio**: expo-av
- **PDF**: react-native-pdf
- **Biometrics**: expo-local-authentication
- **Storage**: AsyncStorage

## Backend

Connects to Django backend with:
- JWT authentication
- S3 storage for audio/PDF files
- PostgreSQL database

See `CLAUDE.md` for API configuration and development details.

## Development

```bash
npm start          # Start dev server
npm run lint       # Run ESLint
npm run ios        # iOS simulator
npm run android    # Android emulator
npm run web        # Web browser
```

## License

Proprietary software developed for Associação Padmakara Portugal.
