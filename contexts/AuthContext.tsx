import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { User } from '@/types';
import authService from '@/services/authService';
import magicLinkService from '@/services/magicLinkService';
import apiService from '@/services/apiService';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  isDeviceActivated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithBiometric: () => Promise<{ success: boolean; error?: string }>;
  activateDeviceWithToken: (token: string) => Promise<{ success: boolean; error?: string; user?: User; device_name?: string }>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  enableBiometric: () => Promise<{ success: boolean; error?: string }>;
  disableBiometric: () => Promise<{ success: boolean; error?: string }>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeviceActivated, setIsDeviceActivated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Platform-specific debugging helper
  const logDebugInfo = (message: string, data?: any) => {
    if (__DEV__) {
      const timestamp = new Date().toISOString();
      const platformInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        timestamp
      };
      console.log(`[${timestamp}] 🔐 ${message}`, { ...platformInfo, ...data });
    }
  };

  useEffect(() => {
    initializeAuth();
    
    // Listen for auth state changes from API service (401 responses)
    const handleAuthStateChange = async () => {
      logDebugInfo('Auth state change detected, reinitializing...', {
        currentAuth: isAuthenticated,
        currentDevice: isDeviceActivated
      });
      await initializeAuth();
    };

    
    apiService.addAuthStateListener(handleAuthStateChange);
    
    // Set up session health monitoring with platform-specific intervals
    const setupSessionMonitoring = () => {
      // Platform-specific monitoring intervals
      const getMonitoringInterval = () => {
        if (Platform.OS === 'web') {
          return 3 * 60 * 1000; // 3 minutes for web (more frequent due to tab switching)
        } else {
          return 5 * 60 * 1000; // 5 minutes for native apps
        }
      };
      
      // Check session health periodically
      return setInterval(async () => {
        if (isAuthenticated && !isLoading) {
          logDebugInfo('Performing periodic session health check', {
            platform: Platform.OS,
            interval: getMonitoringInterval() / 1000 / 60 + ' minutes'
          });
          
          try {
            // Validate the current authentication token
            const tokenValid = await apiService.validateAuthToken();
            if (!tokenValid) {
              logDebugInfo('Token validation failed, session is invalid');
              // This will trigger a 401 handler which will clear auth state
              handleAuthStateChange();
            } else {
              logDebugInfo('Session health check passed');
            }
          } catch (error) {
            logDebugInfo('Session health check error', {
              error: error instanceof Error ? error.message : 'Unknown error',
              platform: Platform.OS
            });
          }
        }
      }, getMonitoringInterval());
    };
    
    const sessionMonitorInterval = setupSessionMonitoring();
    
    // Cleanup listeners and intervals on unmount
    return () => {
      apiService.removeAuthStateListener(handleAuthStateChange);
      if (sessionMonitorInterval) {
        clearInterval(sessionMonitorInterval);
      }
    };
  }, []);

  const initializeAuth = async () => {
    try {
      console.log('🔐 Initializing authentication state...', {
        isInitialized,
        currentAuth: isAuthenticated,
        currentDevice: isDeviceActivated
      });
      
      // Don't re-initialize if we're already successfully authenticated
      if (isInitialized && isAuthenticated && isDeviceActivated && !isLoading) {
        console.log('✅ Already authenticated and initialized, skipping re-initialization');
        return;
      }
      
      console.log('📱 Platform info:', {
        platform: Platform.OS,
        version: Platform.Version,
        isWeb: Platform.OS === 'web',
        isDev: __DEV__
      });
      setIsLoading(true);
      
      // Add timeout to prevent hanging on AsyncStorage operations
      const initWithTimeout = async () => {
        // Check device activation first (magic link flow)
        console.log('📱 Checking device activation status...');
        const deviceActivated = await magicLinkService.isDeviceActivated();
        console.log(`📱 Device activated: ${deviceActivated}`);
        
        // Platform-specific debugging
        if (Platform.OS === 'web') {
          console.log('🌐 Web platform detected - checking localStorage compatibility');
        } else if (Platform.OS === 'ios') {
          console.log('🍎 iOS platform detected - using native AsyncStorage');
        } else if (Platform.OS === 'android') {
          console.log('🤖 Android platform detected - using native AsyncStorage');
        }
        
        setIsDeviceActivated(deviceActivated);

        if (deviceActivated) {
          // Device is activated, check auth state
          console.log('🔍 Getting authentication state...');
          const authState = await authService.getAuthState();
          console.log('🔍 Auth state:', { 
            isAuthenticated: authState.isAuthenticated, 
            hasUser: !!authState.user, 
            hasToken: !!authState.token,
            tokenPrefix: authState.token?.substring(0, 10) + '...',
            platform: Platform.OS,
            userEmail: authState.user?.email || 'none'
          });
          
          if (authState.isAuthenticated && authState.user && authState.token) {
            console.log('✅ Auth state valid, user authenticated');
            setIsAuthenticated(true);
            setUser(authState.user);

            // Try to refresh session to ensure token is still valid
            try {
              console.log('🔄 Attempting session refresh...');
              const refreshResult = await authService.refreshSession();
              if (refreshResult.success && refreshResult.user) {
                console.log('🔄 Session refreshed successfully');
                setUser(refreshResult.user);
              } else {
                console.log('⚠️ Session refresh failed, but keeping current auth state');
                
                // Platform-specific debugging for refresh failures
                if (Platform.OS === 'web') {
                  console.log('🌐 Web refresh failure - checking network connectivity');
                } else {
                  console.log('📱 Native refresh failure - checking AsyncStorage state');
                }
              }
            } catch (refreshError) {
              console.warn('Session refresh error (keeping current auth):', refreshError);
              
              // Enhanced error logging with platform context
              console.log('📱 Platform-specific refresh error context:', {
                platform: Platform.OS,
                error: refreshError instanceof Error ? refreshError.message : 'Unknown error',
                isDev: __DEV__
              });
            }
          } else {
            console.log('❌ Auth state invalid or missing - device activated but auth tokens missing');
            console.log('🔧 Attempting to resolve device/auth state mismatch...');
            
            // Device shows as activated but auth tokens are missing
            // This can happen if AsyncStorage was cleared partially or tokens expired
            // Try to resolve the state mismatch
            
            try {
              // Check with magic link service for activation status
              const activationStatus = await magicLinkService.checkActivationStatus();
              console.log('🔍 Backend activation status:', activationStatus);
              
              if (activationStatus.success && activationStatus.data?.isActivated && activationStatus.data?.user) {
                console.log('✅ Backend confirms device is activated with valid user');
                setIsAuthenticated(true);
                setUser(activationStatus.data.user);
                setIsDeviceActivated(true);
              } else {
                console.log('❌ Backend shows device not activated, clearing local activation status');
                // Clear inconsistent state
                await magicLinkService.clearDeviceActivation();
                setIsDeviceActivated(false);
                setIsAuthenticated(false);
                setUser(null);
              }
            } catch (backendError) {
              console.error('Error checking backend activation status:', backendError);
              
              // Fallback: If we can't reach backend, clear the inconsistent state
              console.log('🧹 Clearing inconsistent activation state due to backend error');
              await magicLinkService.clearDeviceActivation();
              setIsDeviceActivated(false);
              setIsAuthenticated(false);
              setUser(null);
            }
          }
        } else {
          // Device not activated, user needs to go through magic link flow
          console.log('📱 Device not activated, redirecting to magic link flow');
          setIsAuthenticated(false);
          setUser(null);
        }
      };

      // Run with timeout
      await Promise.race([
        initWithTimeout(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth initialization timeout')), 10000)
        )
      ]);

    } catch (error) {
      console.error('Error initializing auth:', error);
      
      // Enhanced error logging with platform and environment context
      console.error('📱 Auth initialization failed with context:', {
        platform: Platform.OS,
        version: Platform.Version,
        isDev: __DEV__,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      // Platform-specific error recovery
      if (Platform.OS === 'web' && error instanceof Error && error.message.includes('localStorage')) {
        console.warn('🌐 Web localStorage error detected - user may have disabled storage');
      } else if (Platform.OS !== 'web' && error instanceof Error && error.message.includes('AsyncStorage')) {
        console.warn('📱 Native AsyncStorage error detected - storage may be corrupted');
      }
      
      // On error, assume not authenticated
      setIsAuthenticated(false);
      setUser(null);
      setIsDeviceActivated(false);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  };

  // Expose refresh method for manual auth state refresh
  const handleRefreshAuth = async () => {
    console.log('🔄 Manual auth refresh requested');
    await initializeAuth();
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

  const handleActivateDeviceWithToken = async (token: string) => {
    try {
      console.log('🔗 Starting device activation with token');
      setIsLoading(true);
      const result = await magicLinkService.activateDevice(token);
      
      if (result.success && result.data && result.data.status === 'device_activated') {
        console.log('✅ Device activation successful, updating auth states');
        
        // Update states atomically to prevent race conditions
        setIsDeviceActivated(true);
        setIsAuthenticated(true);
        setUser(result.data.user);
        
        // Reset initialization flag to allow proper re-evaluation
        setIsInitialized(false);
        
        console.log('🔐 Auth states updated:', {
          isDeviceActivated: true,
          isAuthenticated: true,
          userName: result.data.user?.name
        });
        
        // Force a brief delay to ensure state updates have propagated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return { 
          success: true, 
          user: result.data.user,
          device_name: result.data.device_activation?.device_name
        };
      }
      
      console.log('❌ Device activation failed:', result.error);
      return { success: false, error: result.error || 'Device activation failed' };
    } catch (error) {
      console.error('Device activation error:', error);
      return { success: false, error: 'Device activation failed' };
    } finally {
      setIsLoading(false);
      console.log('🔐 Device activation completed, loading state cleared');
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      
      // Deactivate device on backend BEFORE clearing auth tokens
      // This needs to happen while we still have valid authentication
      await magicLinkService.deactivateDeviceOnBackend();
      
      // Now clear local auth data
      await authService.logout();
      await magicLinkService.clearDeviceActivation();
      
      setIsAuthenticated(false);
      setUser(null);
      setIsDeviceActivated(false);
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
    isDeviceActivated,
    login: handleLogin,
    signup: handleSignup,
    loginWithBiometric: handleBiometricLogin,
    activateDeviceWithToken: handleActivateDeviceWithToken,
    logout: handleLogout,
    updateUser: handleUpdateUser,
    enableBiometric: handleEnableBiometric,
    disableBiometric: handleDisableBiometric,
    refreshAuth: handleRefreshAuth,
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