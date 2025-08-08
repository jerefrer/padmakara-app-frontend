import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import authService from '@/services/authService';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithBiometric: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  enableBiometric: () => Promise<{ success: boolean; error?: string }>;
  disableBiometric: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const authState = await authService.getAuthState();
      setIsAuthenticated(authState.isAuthenticated);
      setUser(authState.user);

      // Refresh session if authenticated
      if (authState.isAuthenticated && authState.user) {
        const refreshResult = await authService.refreshSession();
        if (refreshResult.success && refreshResult.user) {
          setUser(refreshResult.user);
        }
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const result = await authService.login({ email, password });
      
      if (result.success && result.user) {
        setIsAuthenticated(true);
        setUser(result.user);
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (name: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      const result = await authService.signup({ name, email, password });
      
      if (result.success && result.user) {
        setIsAuthenticated(true);
        setUser(result.user);
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Account creation failed' };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Account creation failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      setIsLoading(true);
      const result = await authService.loginWithBiometric();
      
      if (result.success && result.user) {
        setIsAuthenticated(true);
        setUser(result.user);
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Biometric authentication failed' };
    } catch (error) {
      console.error('Biometric login error:', error);
      return { success: false, error: 'Biometric authentication failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (userData: Partial<User>) => {
    try {
      const result = await authService.updateUser(userData);
      
      if (result.success && result.user) {
        setUser(result.user);
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Update failed' };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, error: 'Update failed' };
    }
  };

  const handleEnableBiometric = async () => {
    try {
      const result = await authService.enableBiometric();
      
      if (result.success) {
        // Refresh user data to get updated preferences
        const authState = await authService.getAuthState();
        if (authState.user) {
          setUser(authState.user);
        }
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Failed to enable biometric authentication' };
    } catch (error) {
      console.error('Enable biometric error:', error);
      return { success: false, error: 'Failed to enable biometric authentication' };
    }
  };

  const handleDisableBiometric = async () => {
    try {
      const result = await authService.disableBiometric();
      
      if (result.success) {
        // Refresh user data to get updated preferences
        const authState = await authService.getAuthState();
        if (authState.user) {
          setUser(authState.user);
        }
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Failed to disable biometric authentication' };
    } catch (error) {
      console.error('Disable biometric error:', error);
      return { success: false, error: 'Failed to disable biometric authentication' };
    }
  };

  const value: AuthContextType = {
    isAuthenticated,
    user,
    isLoading,
    login: handleLogin,
    signup: handleSignup,
    loginWithBiometric: handleBiometricLogin,
    logout: handleLogout,
    updateUser: handleUpdateUser,
    enableBiometric: handleEnableBiometric,
    disableBiometric: handleDisableBiometric,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}