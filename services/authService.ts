import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { User } from '@/types';

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

  // Authentication State Management
  async getAuthState(): Promise<AuthState> {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userData = await AsyncStorage.getItem('user_data');
      
      if (token && userData) {
        return {
          isAuthenticated: true,
          user: JSON.parse(userData),
          token,
        };
      }
      
      return {
        isAuthenticated: false,
        user: null,
        token: null,
      };
    } catch (error) {
      console.error('Error getting auth state:', error);
      return {
        isAuthenticated: false,
        user: null,
        token: null,
      };
    }
  }

  async login(credentials: LoginCredentials): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In production, this would validate credentials with your backend
      // For demo, accept any email/password combination
      const mockUser: User = {
        id: '1',
        name: 'Demo User',
        email: credentials.email,
        avatar: null,
        preferences: {
          language: 'en',
          contentLanguage: 'en',
          biometricEnabled: false,
          notifications: true,
        },
        subscription: {
          status: 'active',
          plan: 'premium',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };

      const token = `demo_token_${Date.now()}`;
      
      // Store auth data
      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('user_data', JSON.stringify(mockUser));
      
      return { success: true, user: mockUser };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }

  async signup(data: SignupData): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In production, this would create a user account with your backend
      const newUser: User = {
        id: `user_${Date.now()}`,
        name: data.name,
        email: data.email,
        avatar: null,
        preferences: {
          language: 'en',
          contentLanguage: 'en',
          biometricEnabled: false,
          notifications: true,
        },
        subscription: {
          status: 'active',
          plan: 'premium',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };

      const token = `demo_token_${Date.now()}`;
      
      // Store auth data
      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('user_data', JSON.stringify(newUser));
      
      return { success: true, user: newUser };
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
          await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
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
      await AsyncStorage.multiRemove([
        'auth_token',
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

      const updatedUser = {
        ...currentAuth.user,
        ...userData,
      };

      await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
      return { success: true, user: updatedUser };
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

  // Session Management
  async refreshSession(): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const authState = await this.getAuthState();
      if (!authState.isAuthenticated || !authState.token) {
        return { success: false, error: 'No active session' };
      }

      // In production, this would validate the token with your backend
      // For demo, just update the last login time
      if (authState.user) {
        const updatedUser = {
          ...authState.user,
          lastLogin: new Date().toISOString(),
        };
        await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
        return { success: true, user: updatedUser };
      }

      return { success: false, error: 'Invalid session' };
    } catch (error) {
      console.error('Refresh session error:', error);
      return { success: false, error: 'Session refresh failed' };
    }
  }

  // Password Management
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In production, this would send a password reset email
      console.log('Password reset requested for:', email);
      
      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: 'Password reset failed' };
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In production, this would verify current password and update with new one
      console.log('Password changed successfully');
      
      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: 'Password change failed' };
    }
  }
}

export default AuthService.getInstance();