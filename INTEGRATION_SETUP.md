# Frontend-Backend Integration Setup

This document describes the completed integration between the React Native frontend and Django backend for authentication and retreat data loading.

## What Has Been Implemented

### 1. API Configuration (`services/apiConfig.ts`)
- Base API configuration pointing to Django backend
- Complete endpoint definitions matching Django URL patterns
- Error handling and response typing
- Development vs production API URL switching

### 2. Base API Service (`services/apiService.ts`)
- HTTP client wrapper with authentication handling
- Automatic token refresh on 401 errors
- Network error handling and retry logic
- File upload support for future features

### 3. Updated Authentication Service (`services/authService.ts`)
- **REPLACED MOCK DATA** with real Django API calls
- JWT token-based authentication with refresh tokens
- Backend-integrated login, signup, logout, and user updates
- Session management with automatic token refresh
- Password reset and change functionality

### 4. Retreat Service (`services/retreatService.ts`)
- Fetch user's retreat groups and attended gatherings
- Get detailed information for specific retreats/gatherings
- Presigned URL handling for secure S3 content access
- Search functionality for content discovery

### 5. Updated Retreat Screen (`app/(tabs)/retreats.tsx`)
- **REPLACED MOCK DATA** with backend API integration
- Loading states, error handling, and retry functionality
- Real-time data loading from Django backend
- Proper error messages and empty states

### 6. Updated Type Definitions (`types/index.ts`)
- Updated to match Django backend model structure
- Added backend field names (created_at, dharma_name, etc.)
- Enhanced type safety for API responses

## Testing the Integration

### Prerequisites
1. Django backend must be running on `http://localhost:8000`
2. Backend should have authentication endpoints configured
3. At least one test user with retreat group access

### Backend Requirements
The Django backend needs these API endpoints:
- `POST /api/auth/login/` - User authentication
- `POST /api/auth/signup/` - User registration  
- `POST /api/auth/logout/` - User logout
- `POST /api/auth/refresh/` - Token refresh
- `GET /api/retreats/user-retreats/` - User's retreat data

### Testing Flow
1. **Start the backend**: `cd ../padmakara-backend && python manage.py runserver`
2. **Start the frontend**: `npm start`
3. **Test authentication**:
   - Try logging in with valid credentials
   - Verify JWT tokens are stored and used
   - Test biometric authentication (if enabled)
4. **Test retreat loading**:
   - Navigate to Retreats tab after login
   - Verify data loads from backend
   - Test error states by stopping backend
   - Test retry functionality

### API Response Expected Format

The backend should return data in this format for `/api/retreats/user-retreats/`:

```json
{
  "retreat_groups": [
    {
      "id": "uuid",
      "name": "Group Name",
      "description": "Description",
      "gatherings": [
        {
          "id": "uuid", 
          "name": "Gathering Name",
          "season": "spring",
          "year": 2024,
          "startDate": "2024-03-01",
          "endDate": "2024-03-03",
          "sessions": []
        }
      ]
    }
  ],
  "total_stats": {
    "total_groups": 1,
    "total_gatherings": 1, 
    "total_tracks": 5,
    "completed_tracks": 2
  }
}
```

## Error Handling

The integration includes comprehensive error handling for:
- Network connectivity issues
- Authentication failures (401 errors)
- Server errors (500+ status codes)
- Timeout errors
- Invalid response formats

## Security Features

- JWT tokens stored securely in AsyncStorage
- Automatic token refresh before expiration
- Secure logout with backend notification
- Biometric authentication support maintained
- Presigned URLs for secure S3 content access

## Next Steps

After confirming the basic integration works:

1. **Progress Tracking**: Implement user progress service
2. **Audio Streaming**: Add presigned URL handling for audio playback
3. **Offline Support**: Implement download and sync functionality
4. **PDF Viewer**: Integrate transcript viewing with backend data
5. **Bookmarks**: Connect bookmark system to backend
6. **Push Notifications**: Add real-time updates for new content

## Troubleshooting

**Common Issues:**

1. **Connection Refused**: Backend not running or wrong URL
2. **401 Unauthorized**: Check authentication endpoints and token format
3. **CORS Issues**: Configure Django CORS settings for React Native
4. **Network Errors**: Check device network connectivity
5. **Type Errors**: Ensure backend response format matches TypeScript types

**Debug Tips:**

- Check console logs for detailed error messages
- Use network inspector to verify API calls
- Test backend endpoints independently with curl/Postman
- Verify Django CORS and authentication middleware configuration