import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { User } from '@/types';
import apiService from './apiService';
import { API_ENDPOINTS } from './apiConfig';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupData {
  name: string;
  email: string;
  password: string;
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
      const storagePromises = [
        this.safeGetItem('auth_token'),
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
          await this.safeRemoveItem('auth_token');
          return {
            isAuthenticated: false,
            user: null,
            token: null,
          };
        }
        
        // Additional validation for development tokens
        if (__DEV__ && token.startsWith('dev-token-')) {
          console.log('🎭 Development token detected, skipping backend validation');
          return {
            isAuthenticated: true,
            user,
            token,
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
          await this.safeMultiRemove(['auth_token', 'user_data']);
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

  async login(credentials: LoginCredentials): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      console.log('Attempting login with Django backend...');
      
      // Call Django backend login endpoint
      const response = await apiService.post<{
        access: string;
        refresh: string;
        user: User;
      }>(API_ENDPOINTS.LOGIN, {
        email: credentials.email,
        password: credentials.password,
      });

      if (!response.success || !response.data) {
        return { 
          success: false, 
          error: response.error || 'Login failed. Please check your credentials.' 
        };
      }

      const { access: token, refresh: refreshToken, user } = response.data;
      
      // Store auth data with error handling
      const storageOperations = [
        this.safeSetItem('auth_token', token),
        this.safeSetItem('refresh_token', refreshToken),
        this.safeSetItem('user_data', JSON.stringify(user))
      ];
      
      const results = await Promise.all(storageOperations);
      if (!results.every(result => result)) {
        console.warn('Some auth data failed to save to AsyncStorage');
      }
      
      console.log('Login successful, user authenticated');
      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }

  async signup(data: SignupData): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      console.log('Attempting signup with Django backend...');
      
      // Call Django backend signup endpoint
      const response = await apiService.post<{
        access: string;
        refresh: string;
        user: User;
      }>(API_ENDPOINTS.SIGNUP, {
        name: data.name,
        email: data.email,
        password: data.password,
      });

      if (!response.success || !response.data) {
        return { 
          success: false, 
          error: response.error || 'Account creation failed. Please try again.' 
        };
      }

      const { access: token, refresh: refreshToken, user } = response.data;
      
      // Store auth data with error handling
      const storageOperations = [
        this.safeSetItem('auth_token', token),
        this.safeSetItem('refresh_token', refreshToken),
        this.safeSetItem('user_data', JSON.stringify(user))
      ];
      
      const results = await Promise.all(storageOperations);
      if (!results.every(result => result)) {
        console.warn('Some auth data failed to save to AsyncStorage');
      }
      
      console.log('Signup successful, user registered and authenticated');
      return { success: true, user };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Account creation failed. Please try again.' };
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
      
      // Clear local storage with error handling
      await this.safeMultiRemove([
        'auth_token',
        'refresh_token',
        'user_data',
      ]);
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

  // Session Management - Magic Link Only (No Refresh Tokens)
  async refreshSession(): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      console.log('🔄 Magic Link session check...');
      
      // In magic link auth, we don't refresh tokens - we validate current session
      const authState = await this.getAuthState();
      if (!authState.isAuthenticated || !authState.user) {
        console.log('❌ No valid session found');
        return { success: false, error: 'No valid session' };
      }

      // For development tokens, always return valid
      if (__DEV__ && authState.token && authState.token.startsWith('dev-token-')) {
        console.log('🎭 Development mode: Session valid');
        return { success: true, user: authState.user };
      }
      
      // For magic link auth, the session is either valid or not - no refresh needed
      // The device activation status determines session validity
      console.log('✅ Magic link session valid');
      return { success: true, user: authState.user };

    } catch (error) {
      console.error('Session check error:', error);
      
      // Development fallback
      if (__DEV__) {
        const userData = await this.safeGetItem('user_data');
        const token = await this.safeGetItem('auth_token');
        if (userData && token && token.startsWith('dev-token-')) {
          console.log('🎭 Development mode: Using fallback session');
          try {
            const user = JSON.parse(userData);
            return { success: true, user };
          } catch (parseError) {
            console.error('Error parsing user data in fallback:', parseError);
          }
        }
      }
      
      return { success: false, error: 'Session check failed' };
    }
  }

  // Password Management
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiService.post(API_ENDPOINTS.RESET_PASSWORD, { email });
      
      if (!response.success) {
        return { 
          success: false, 
          error: response.error || 'Password reset failed' 
        };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: 'Password reset failed' };
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiService.post(API_ENDPOINTS.CHANGE_PASSWORD, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      
      if (!response.success) {
        return { 
          success: false, 
          error: response.error || 'Password change failed' 
        };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: 'Password change failed' };
    }
  }
}

export default AuthService.getInstance();