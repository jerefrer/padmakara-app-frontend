# Padmakara App API Documentation

## Base URL
- **Development**: `https://dev-api.padmakara.app`
- **Production**: `https://api.padmakara.app`

## Authentication
All API endpoints require authentication via AWS Cognito JWT tokens, except for public endpoints.

### Headers
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
X-API-Version: 1.0
```

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details (optional)",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Authentication Endpoints

### Login
**POST** `/auth/login`

Request:
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name",
    "preferences": {
      "language": "en",
      "contentLanguage": "en",
      "biometricEnabled": false,
      "notifications": true
    }
  }
}
```

### Register
**POST** `/auth/register`

Request:
```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "securepassword"
}
```

Response:
```json
{
  "message": "Registration successful. Please verify your email.",
  "userId": "user-uuid"
}
```

### Refresh Token
**POST** `/auth/refresh`

Request:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

### Logout
**POST** `/auth/logout`

Request:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Response:
```json
{
  "message": "Logout successful"
}
```

## User Management Endpoints

### Get User Profile
**GET** `/user/profile`

Response:
```json
{
  "id": "user-uuid",
  "name": "User Name",
  "email": "user@example.com",
  "avatar": "https://cdn.padmakara.app/avatars/user.jpg",
  "preferences": {
    "language": "en",
    "contentLanguage": "en",
    "biometricEnabled": false,
    "notifications": true
  },
  "subscription": {
    "status": "active",
    "plan": "premium",
    "expiresAt": "2024-12-31T23:59:59Z"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "lastLogin": "2024-01-15T10:00:00Z"
}
```

### Update User Profile
**PUT** `/user/profile`

Request:
```json
{
  "name": "Updated Name",
  "preferences": {
    "language": "pt",
    "contentLanguage": "en-pt",
    "biometricEnabled": true,
    "notifications": false
  }
}
```

Response:
```json
{
  "message": "Profile updated successfully",
  "user": {
    // Updated user object
  }
}
```

## Content Management Endpoints

### List Retreat Groups
**GET** `/content/retreats`

Query Parameters:
- `language` (optional): Filter by content language (`en`, `pt`, `en-pt`)
- `year` (optional): Filter by year
- `season` (optional): Filter by season (`spring`, `fall`)

Response:
```json
{
  "retreatGroups": [
    {
      "id": "retreat-group-uuid",
      "name": "Mind Training Series",
      "description": "37 Practices of Bodhisattvas",
      "gatherings": [
        {
          "id": "gathering-uuid",
          "name": "Spring Gathering 2024",
          "season": "spring",
          "year": 2024,
          "startDate": "2024-03-15",
          "endDate": "2024-03-17",
          "sessionCount": 6,
          "trackCount": 15
        }
      ]
    }
  ]
}
```

### Get Retreat Details
**GET** `/content/retreat/{retreatId}`

Response:
```json
{
  "id": "retreat-group-uuid",
  "name": "Mind Training Series",
  "description": "37 Practices of Bodhisattvas",
  "gatherings": [
    {
      "id": "gathering-uuid",
      "name": "Spring Gathering 2024",
      "season": "spring",
      "year": 2024,
      "startDate": "2024-03-15",
      "endDate": "2024-03-17",
      "sessions": [
        {
          "id": "session-uuid",
          "name": "Day 1 Morning",
          "type": "morning",
          "date": "2024-03-15",
          "tracks": [
            {
              "id": "track-uuid",
              "title": "Introduction to Mind Training",
              "duration": 3600,
              "order": 1,
              "language": "en",
              "hasTranscript": true
            }
          ]
        }
      ]
    }
  ]
}
```

### Get Track Metadata
**GET** `/content/track/{trackId}`

Response:
```json
{
  "id": "track-uuid",
  "title": "Introduction to Mind Training",
  "description": "Overview of the 37 practices",
  "duration": 3600,
  "language": "en",
  "hasTranscript": true,
  "tags": ["introduction", "mind-training", "bodhisattva"],
  "retreat": {
    "id": "retreat-uuid",
    "name": "Mind Training Series"
  },
  "session": {
    "id": "session-uuid",
    "name": "Day 1 Morning",
    "date": "2024-03-15"
  }
}
```

### Search Content
**GET** `/content/search`

Query Parameters:
- `q` (required): Search query
- `type` (optional): Content type (`track`, `transcript`)
- `language` (optional): Content language
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset

Response:
```json
{
  "results": [
    {
      "id": "track-uuid",
      "type": "track",
      "title": "Introduction to Mind Training",
      "description": "Overview of the 37 practices",
      "duration": 3600,
      "relevanceScore": 0.95,
      "highlights": [
        "Introduction to <mark>Mind Training</mark>"
      ]
    }
  ],
  "totalCount": 15,
  "hasMore": true
}
```

## Progress Tracking Endpoints

### Get User Progress
**GET** `/progress/user`

Query Parameters:
- `trackId` (optional): Get progress for specific track
- `limit` (optional): Number of results
- `offset` (optional): Pagination offset

Response:
```json
{
  "progress": [
    {
      "trackId": "track-uuid",
      "position": 1800,
      "completed": false,
      "lastPlayed": "2024-01-15T10:00:00Z",
      "totalListeningTime": 3600,
      "bookmarks": [
        {
          "id": "bookmark-uuid",
          "position": 900,
          "note": "Important point about compassion",
          "createdAt": "2024-01-15T09:30:00Z"
        }
      ]
    }
  ],
  "statistics": {
    "totalTracks": 45,
    "completedTracks": 12,
    "totalListeningTime": 86400,
    "totalBookmarks": 23,
    "totalHighlights": 15
  }
}
```

### Update Track Progress
**POST** `/progress/track`

Request:
```json
{
  "trackId": "track-uuid",
  "position": 1800,
  "completed": false,
  "sessionData": {
    "startTime": "2024-01-15T10:00:00Z",
    "endTime": "2024-01-15T10:30:00Z",
    "deviceInfo": {
      "platform": "ios",
      "version": "1.0.0"
    }
  }
}
```

Response:
```json
{
  "message": "Progress updated successfully",
  "progress": {
    "trackId": "track-uuid",
    "position": 1800,
    "completed": false,
    "lastPlayed": "2024-01-15T10:30:00Z"
  }
}
```

### Create Bookmark
**POST** `/progress/bookmark`

Request:
```json
{
  "trackId": "track-uuid",
  "position": 900,
  "note": "Important point about compassion"
}
```

Response:
```json
{
  "bookmark": {
    "id": "bookmark-uuid",
    "trackId": "track-uuid",
    "position": 900,
    "note": "Important point about compassion",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### Delete Bookmark
**DELETE** `/progress/bookmark/{bookmarkId}`

Response:
```json
{
  "message": "Bookmark deleted successfully"
}
```

## Content Delivery Endpoints

### Get Audio Stream URL
**GET** `/media/audio/{trackId}`

Query Parameters:
- `quality` (optional): Audio quality (`low`, `medium`, `high`)

Response:
```json
{
  "url": "https://cdn.padmakara.app/audio/track.mp3?signature=...",
  "expiresAt": "2024-01-15T11:00:00Z",
  "contentType": "audio/mpeg",
  "duration": 3600
}
```

### Get Transcript URL
**GET** `/media/transcript/{trackId}`

Response:
```json
{
  "url": "https://cdn.padmakara.app/transcripts/track.pdf?signature=...",
  "expiresAt": "2024-01-15T11:00:00Z",
  "contentType": "application/pdf",
  "pageCount": 12
}
```

### Request Offline Content
**POST** `/media/download`

Request:
```json
{
  "trackIds": ["track-uuid-1", "track-uuid-2"],
  "includeTranscripts": true,
  "quality": "medium"
}
```

Response:
```json
{
  "downloadId": "download-uuid",
  "status": "preparing",
  "estimatedSize": 52428800,
  "expiresAt": "2024-01-16T10:00:00Z"
}
```

## Notification Endpoints

### Get Notifications
**GET** `/notifications`

Response:
```json
{
  "notifications": [
    {
      "id": "notification-uuid",
      "type": "new_content",
      "title": "New Retreat Available",
      "message": "Spring Gathering 2024 is now available",
      "read": false,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Mark Notification as Read
**PUT** `/notifications/{notificationId}/read`

Response:
```json
{
  "message": "Notification marked as read"
}
```

## WebSocket Events (Real-time Updates)

### Connection
Connect to: `wss://api.padmakara.app/ws`

### Events

#### Progress Sync
```json
{
  "type": "progress_sync",
  "data": {
    "trackId": "track-uuid",
    "position": 1800,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### New Content
```json
{
  "type": "new_content",
  "data": {
    "retreatId": "retreat-uuid",
    "title": "New Gathering Available",
    "trackCount": 12
  }
}
```

## Rate Limits

- **Authentication**: 100 requests per hour per IP
- **Content API**: 1000 requests per hour per user
- **Progress Updates**: 500 requests per hour per user
- **Media Requests**: 200 requests per hour per user

## SDK Examples

### JavaScript/TypeScript
```typescript
import { PadmakaraClient } from '@padmakara/api-client';

const client = new PadmakaraClient({
  baseUrl: 'https://api.padmakara.app',
  apiKey: 'your-api-key'
});

// Login
const { user, accessToken } = await client.auth.login({
  email: 'user@example.com',
  password: 'password'
});

// Get retreats
const retreats = await client.content.getRetreats({
  language: 'en'
});
```

### Swift (iOS)
```swift
import PadmakaraSDK

let client = PadmakaraClient(
  baseURL: "https://api.padmakara.app",
  apiKey: "your-api-key"
)

// Login
client.auth.login(email: "user@example.com", password: "password") { result in
  switch result {
  case .success(let authResponse):
    // Handle success
  case .failure(let error):
    // Handle error
  }
}
```

This API documentation provides a comprehensive guide for integrating with the Padmakara app backend services.