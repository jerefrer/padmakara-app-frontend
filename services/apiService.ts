import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_CONFIG, API_ENDPOINTS, ApiResponse, ApiError, getAuthHeaders } from './apiConfig';
import { router } from 'expo-router';

class ApiService {
  private static instance: ApiService;
  private authStateListeners: Array<() => void> = [];
  
  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  // Add listener for auth state changes
  addAuthStateListener(listener: () => void) {
    this.authStateListeners.push(listener);
  }

  // Remove listener
  removeAuthStateListener(listener: () => void) {
    this.authStateListeners = this.authStateListeners.filter(l => l !== listener);
  }

  // Notify all listeners of auth state change
  private notifyAuthStateChange() {
    this.authStateListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }

  // Handle authentication failure globally with platform-specific handling
  private async handleAuthFailure() {
    console.log('🔐 Authentication failure detected - clearing auth state and redirecting');
    console.log('📱 Platform context:', {
      platform: Platform.OS,
      version: Platform.Version,
      isDev: __DEV__
    });
    
    // Clear all auth-related data with platform-specific handling
    try {
      await AsyncStorage.multiRemove([
        'auth_token', 
        'refresh_token',
        'user_data',
        'device_activated',
        'activation_date'
      ]);
      console.log('✅ Auth data cleared successfully');
    } catch (clearError) {
      console.error('❌ Failed to clear auth data:', clearError);
      
      // Platform-specific error handling
      if (Platform.OS === 'web') {
        console.warn('🌐 Web storage clear failed - user may have disabled localStorage');
      } else {
        console.warn('📱 Native storage clear failed - AsyncStorage may be corrupted');
      }
    }
    
    // Notify auth context of state change
    this.notifyAuthStateChange();
    
    // Platform-specific redirect timing
    const redirectDelay = Platform.OS === 'web' ? 50 : 100;
    
    // Redirect to login after a short delay to allow state updates
    setTimeout(() => {
      try {
        router.replace('/(auth)/magic-link');
        console.log('✅ Redirected to login successfully');
      } catch (error) {
        console.error('❌ Error redirecting to login:', error);
        console.log('📱 Redirect error context:', {
          platform: Platform.OS,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, redirectDelay);
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('auth_token');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Defensive check for undefined endpoint
      if (!endpoint || endpoint === 'undefined') {
        console.error('❌ API request with undefined endpoint:', { endpoint, options });
        return {
          success: false,
          error: 'Invalid API endpoint',
        };
      }

      // Defensive check for undefined baseURL
      if (!API_CONFIG.baseURL) {
        console.error('❌ API_CONFIG.baseURL is undefined:', API_CONFIG);
        return {
          success: false,
          error: 'API configuration error',
        };
      }

      const token = await this.getAuthToken();
      const headers = token 
        ? getAuthHeaders(token)
        : API_CONFIG.headers;

      const fullUrl = `${API_CONFIG.baseURL}${endpoint}`;
      console.log('🌐 Making API request to:', fullUrl);

      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
        timeout: API_CONFIG.timeout,
      });

      // Handle authentication errors
      if (response.status === 401) {
        // Check if this is a development token - don't clear auth for dev tokens
        const token = await this.getAuthToken();
        if (__DEV__ && token && token.startsWith('dev-token-')) {
          console.log('🎭 Development mode: 401 from backend but using dev token, ignoring auth failure');
          return {
            success: false,
            error: 'Backend unavailable in development mode',
          };
        }
        
        // Token expired or invalid, handle globally
        await this.handleAuthFailure();
        return {
          success: false,
          error: 'Authentication expired. Please login again.',
        };
      }

      // Parse response
      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: data,
      };
    } catch (error: any) {
      console.error(`API request failed for ${endpoint}:`, error);
      
      // Enhanced error logging with platform context
      console.error('📱 API error context:', {
        endpoint,
        platform: Platform.OS,
        version: Platform.Version,
        error: error.message || 'Unknown error',
        errorName: error.name,
        isDev: __DEV__
      });
      
      // Handle network errors with platform-specific messages
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        const platformMessage = Platform.OS === 'web' 
          ? 'Network error. Please check your internet connection and try again.'
          : 'Network error. Please check your internet connection.';
        
        return {
          success: false,
          error: platformMessage,
        };
      }

      // Handle timeout errors
      if (error.name === 'AbortError' || error.code === 'TIMEOUT') {
        return {
          success: false,
          error: 'Request timeout. Please try again.',
        };
      }

      // Platform-specific error handling
      if (Platform.OS === 'web' && error.message.includes('CORS')) {
        return {
          success: false,
          error: 'Network configuration error. Please try again later.',
        };
      }

      return {
        success: false,
        error: error.message || 'An unexpected error occurred.',
      };
    }
  }

  // HTTP Methods
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }

  // Upload files (for future use with profile pictures, etc.)
  async upload<T>(endpoint: string, file: any, additionalData?: any): Promise<ApiResponse<T>> {
    try {
      const token = await this.getAuthToken();
      const headers: any = token 
        ? { 'Authorization': `Bearer ${token}` }
        : {};

      const formData = new FormData();
      formData.append('file', file);
      
      if (additionalData) {
        Object.keys(additionalData).forEach(key => {
          formData.append(key, additionalData[key]);
        });
      }

      const response = await fetch(`${API_CONFIG.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
        timeout: API_CONFIG.timeout * 2, // Double timeout for uploads
      });

      if (response.status === 401) {
        await this.handleAuthFailure();
        return {
          success: false,
          error: 'Authentication expired. Please login again.',
        };
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `Upload failed: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: data,
      };
    } catch (error: any) {
      console.error(`Upload failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error.message || 'Upload failed.',
      };
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get<{ status: string }>('/health/');
      return response.success && response.data?.status === 'ok';
    } catch {
      return false;
    }
  }

  // Validate current authentication token with platform-specific debugging
  async validateAuthToken(): Promise<boolean> {
    try {
      console.log('🔐 Validating authentication token...', {
        platform: Platform.OS,
        isDev: __DEV__
      });
      
      const token = await this.getAuthToken();
      if (!token) {
        console.log('❌ No token available for validation');
        return false;
      }
      
      // For development tokens, always return true
      if (__DEV__ && token.startsWith('dev-token-')) {
        console.log('🎭 Development token detected, validation passed');
        return true;
      }
      
      // Make a simple authenticated request to validate token using existing endpoint
      console.log('🔍 Making token validation request to backend...');
      const response = await this.get<{ devices: any[] }>(API_ENDPOINTS.LIST_USER_DEVICES);
      
      const isValid = response.success;
      console.log(isValid ? '✅ Token validation passed' : '❌ Token validation failed', {
        platform: Platform.OS,
        hasData: !!response.data
      });
      
      return isValid;
    } catch (error) {
      console.error('❌ Token validation error:', error);
      console.log('📱 Token validation error context:', {
        platform: Platform.OS,
        error: error instanceof Error ? error.message : 'Unknown error',
        isDev: __DEV__
      });
      return false;
    }
  }

  // Clear auth state (for logout)
  async clearAuthState(): Promise<void> {
    await AsyncStorage.multiRemove(['auth_token', 'user_data']);
  }
}

export default ApiService.getInstance();