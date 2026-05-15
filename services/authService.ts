import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { User } from '@/types';
import apiService from './apiService';
import { API_ENDPOINTS } from './apiConfig';
import {
  getAuthToken,
  setAuthToken,
  deleteAuthToken,
  deleteRefreshToken,
} from './tokenStorage';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}


class AuthService {
  private static instance: AuthService;
  
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Authentication State Management with enhanced error handling
  async getAuthState(): Promise<AuthState> {
    try {
      console.log('📱 Getting auth state from AsyncStorage...');
      
      // Use Promise.all with timeout for better performance and error handling
      // auth_token is retrieved via tokenStorage (SecureStore on native, AsyncStorage on web).
      const storagePromises = [
        getAuthToken().catch(() => null),
        this.safeGetItem('user_data')
      ];
      
      const results = await Promise.race([
        Promise.all(storagePromises),
        new Promise<[string | null, string | null]>((_, reject) => 
          setTimeout(() => reject(new Error('AsyncStorage timeout')), 5000)
        )
      ]);
      
      const [token, userData] = results;
      
      console.log('📱 Auth state retrieved:', { 
        hasToken: !!token, 
        hasUserData: !!userData,
        tokenPrefix: token ? token.substring(0, 10) + '...' : 'none'
      });
      
      if (token && userData) {
        let user;
        try {
          user = JSON.parse(userData);
        } catch (parseError) {
          console.error('Error parsing user data:', parseError);
          // Clear corrupted user data
          await this.safeRemoveItem('user_data');
          await deleteAuthToken();
          return {
            isAuthenticated: false,
            user: null,
            token: null,
          };
        }
        
        
        return {
          isAuthenticated: true,
          user,
          token,
        };
      }
      
      console.log('📱 No valid auth state found');
      return {
        isAuthenticated: false,
        user: null,
        token: null,
      };
    } catch (error) {
      console.error('Error getting auth state:', error);
      
      // Try to recover by clearing potentially corrupted data
      if (error instanceof Error && error.message.includes('timeout')) {
        console.warn('AsyncStorage timeout - attempting recovery');
        try {
          await deleteAuthToken();
          await this.safeRemoveItem('user_data');
        } catch (clearError) {
          console.error('Failed to clear corrupted auth data:', clearError);
        }
      }
      
      return {
        isAuthenticated: false,
        user: null,
        token: null,
      };
    }
  }

  // Safe AsyncStorage operations with error handling
  private async safeGetItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Error getting AsyncStorage item '${key}':`, error);
      return null;
    }
  }

  private async safeSetItem(key: string, value: string): Promise<boolean> {
    try {
      await AsyncStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`Error setting AsyncStorage item '${key}':`, error);
      return false;
    }
  }

  private async safeRemoveItem(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing AsyncStorage item '${key}':`, error);
      return false;
    }
  }

  private async safeMultiRemove(keys: string[]): Promise<boolean> {
    try {
      await AsyncStorage.multiRemove(keys);
      return true;
    } catch (error) {
      console.error(`Error removing AsyncStorage items:`, error);
      // Try removing items individually as fallback
      for (const key of keys) {
        await this.safeRemoveItem(key);
      }
      return false;
    }
  }


  async loginWithBiometric(): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // Check if user has biometric enabled
      const authState = await this.getAuthState();
      if (!authState.user?.preferences.biometricEnabled) {
        return { success: false, error: 'Biometric authentication not enabled' };
      }

      // Check biometric availability
      const isAvailable = await LocalAuthentication.hasHardwareAsync();
      if (!isAvailable) {
        return { success: false, error: 'Biometric authentication not available' };
      }

      // Prompt for biometric authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Use your biometric to access your retreat content',
        fallbackLabel: 'Enter Passcode',
      });

      if (result.success) {
        // Update last login
        if (authState.user) {
          const updatedUser = {
            ...authState.user,
            lastLogin: new Date().toISOString(),
          };
          await this.safeSetItem('user_data', JSON.stringify(updatedUser));
          return { success: true, user: updatedUser };
        }
      }

      return { success: false, error: 'Biometric authentication failed' };
    } catch (error) {
      console.error('Biometric login error:', error);
      return { success: false, error: 'Biometric authentication error' };
    }
  }

  async logout(): Promise<void> {
    try {
      // Note: No backend logout call needed for magic link auth
      // Device deactivation is handled separately in the logout flow
      
      // auth_token and refresh_token live in SecureStore on native.
      await deleteAuthToken();
      await deleteRefreshToken();
      await this.safeRemoveItem('user_data');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async updateUser(userData: Partial<User>): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const currentAuth = await this.getAuthState();
      if (!currentAuth.user) {
        return { success: false, error: 'No user logged in' };
      }

      // Call Django backend to update user profile
      const response = await apiService.patch<User>(API_ENDPOINTS.UPDATE_PROFILE, userData);

      if (!response.success || !response.data) {
        return { 
          success: false, 
          error: response.error || 'Failed to update user data' 
        };
      }

      // Update local storage with server response
      await this.safeSetItem('user_data', JSON.stringify(response.data));
      return { success: true, user: response.data };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, error: 'Failed to update user data' };
    }
  }

  async enableBiometric(): Promise<{ success: boolean; error?: string }> {
    try {
      const isAvailable = await LocalAuthentication.hasHardwareAsync();
      if (!isAvailable) {
        return { success: false, error: 'Biometric authentication not available on this device' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric authentication for secure app access',
        fallbackLabel: 'Use passcode',
      });

      if (result.success) {
        // Update user preferences
        const updateResult = await this.updateUser({
          preferences: {
            ...(await this.getAuthState()).user?.preferences,
            biometricEnabled: true,
          } as any,
        });

        if (updateResult.success) {
          return { success: true };
        }
      }

      return { success: false, error: 'Failed to enable biometric authentication' };
    } catch (error) {
      console.error('Enable biometric error:', error);
      return { success: false, error: 'Biometric setup failed' };
    }
  }

  async disableBiometric(): Promise<{ success: boolean; error?: string }> {
    try {
      const updateResult = await this.updateUser({
        preferences: {
          ...(await this.getAuthState()).user?.preferences,
          biometricEnabled: false,
        } as any,
      });

      return updateResult.success 
        ? { success: true }
        : { success: false, error: 'Failed to disable biometric authentication' };
    } catch (error) {
      console.error('Disable biometric error:', error);
      return { success: false, error: 'Failed to disable biometric authentication' };
    }
  }

  // Session Management - refresh access token if a refresh token is available
  async refreshSession(): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      console.log('🔄 Checking session...');

      const authState = await this.getAuthState();
      if (!authState.isAuthenticated || !authState.user) {
        console.log('❌ No valid session found');
        return { success: false, error: 'No valid session' };
      }

      // Validate current token by making a lightweight API call
      const tokenValid = await apiService.validateAuthToken();
      if (tokenValid) {
        console.log('✅ Session still valid');
        return { success: true, user: authState.user };
      }

      // Token expired — the apiService 401 handler will attempt refresh automatically
      // on the next real API call, so just report the current user
      console.log('⚠️ Token may be expired, will refresh on next API call');
      return { success: true, user: authState.user };

    } catch (error) {
      console.error('Session check error:', error);
      return { success: false, error: 'Session check failed' };
    }
  }

}

export default AuthService.getInstance();