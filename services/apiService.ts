import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_CONFIG, API_ENDPOINTS, ApiResponse, ApiError, getAuthHeaders } from './apiConfig';

type RefreshResult = 'refreshed' | 'rejected' | 'transient';

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
    
    // Notify auth context — screens react to the isAuthenticated change.
    // We deliberately do NOT route from here: the service layer shouldn't
    // know about routes (the previous hard-coded target no longer exists
    // and left users on a perpetual loading screen).
    this.notifyAuthStateChange();
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('auth_token');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Attempt to refresh the access token using the stored refresh token.
  //
  // Concurrent callers (e.g. several parallel API calls all hitting 401 on
  // the same expired token) share a single in-flight refresh: every caller
  // awaits the same promise and gets the same result. Without this, only
  // the first caller actually refreshes; the rest see the in-flight flag
  // and incorrectly conclude the refresh failed, then nuke the session.
  //
  // The result discriminates between three outcomes so callers can act
  // appropriately:
  //   - "refreshed": new access token issued, retry the original request
  //   - "rejected": refresh token was rejected by the backend (401/expired)
  //                 — the session is truly dead, log the user out
  //   - "transient": network/server error, retry-able — keep the session
  private refreshInFlight: Promise<RefreshResult> | null = null;

  private async attemptTokenRefresh(): Promise<RefreshResult> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = (async (): Promise<RefreshResult> => {
      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (!refreshToken) {
          console.log('🔐 No refresh token available');
          return 'rejected';
        }

        console.log('🔄 Attempting token refresh...');
        const fullUrl = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.REFRESH_TOKEN}`;
        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (response.status === 401 || response.status === 403) {
          console.log('❌ Refresh token rejected by backend:', response.status);
          return 'rejected';
        }

        if (!response.ok) {
          console.log('⚠️ Token refresh transient failure:', response.status);
          return 'transient';
        }

        const data = await response.json();
        if (data.accessToken) {
          await AsyncStorage.setItem('auth_token', data.accessToken);
          if (data.refreshToken) {
            await AsyncStorage.setItem('refresh_token', data.refreshToken);
          }
          console.log('✅ Token refreshed successfully');
          return 'refreshed';
        }

        return 'transient';
      } catch (error) {
        // Network failure, DNS error, etc. — keep the session, the next
        // request will retry the refresh.
        console.error('⚠️ Token refresh network error (transient):', error);
        return 'transient';
      } finally {
        // Clear the in-flight handle so the next 401 can trigger a fresh
        // attempt. Done in a microtask to make sure all current awaiters
        // have observed the resolved value first.
        queueMicrotask(() => {
          this.refreshInFlight = null;
        });
      }
    })();

    return this.refreshInFlight;
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
      if (!API_CONFIG.BASE_URL) {
        console.error('❌ API_CONFIG.BASE_URL is undefined:', API_CONFIG);
        return {
          success: false,
          error: 'API configuration error',
        };
      }

      const token = await this.getAuthToken();
      const headers = token 
        ? await getAuthHeaders()
        : API_CONFIG.headers;

      const fullUrl = `${API_CONFIG.BASE_URL}${endpoint}`;
      console.log('🌐 Making API request to:', fullUrl);

      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      // Handle authentication errors — try refreshing the token first
      if (response.status === 401) {
        const token = await this.getAuthToken();

        if (token) {
          const refreshResult = await this.attemptTokenRefresh();

          if (refreshResult === 'refreshed') {
            // Retry the original request with the new token
            const newHeaders = await getAuthHeaders();
            const retryResponse = await fetch(fullUrl, {
              ...options,
              headers: { ...newHeaders, ...options.headers },
            });

            // Only treat the session as dead if the retry comes back 401
            // (auth still bad after refresh). Other failures (5xx, network)
            // are surfaced as request errors but the session is preserved.
            if (retryResponse.status === 401) {
              await this.handleAuthFailure();
              return {
                success: false,
                error: 'Authentication expired. Please login again.',
                authRequired: true,
              };
            }

            const contentType = retryResponse.headers.get('content-type');
            const retryData = contentType?.includes('application/json')
              ? await retryResponse.json()
              : await retryResponse.text();

            if (!retryResponse.ok) {
              return {
                success: false,
                error: (retryData as any)?.message || (retryData as any)?.error
                  || `HTTP ${retryResponse.status}: ${retryResponse.statusText}`,
              };
            }
            return { success: true, data: retryData as T };
          }

          if (refreshResult === 'rejected') {
            // Backend explicitly rejected the refresh token — the session
            // is truly dead, log the user out.
            await this.handleAuthFailure();
            return {
              success: false,
              error: 'Authentication expired. Please login again.',
              authRequired: true,
            };
          }

          // 'transient' — network or backend hiccup. Keep the session
          // intact so the next request can retry the refresh; this 401
          // is reported back to the caller without nuking storage.
          return {
            success: false,
            error: 'Authentication check failed. Please try again.',
            authRequired: false,
          };
        }
        return {
          success: false,
          error: 'Authentication required.',
          authRequired: true,
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

      const buildRequest = async (): Promise<Response> => {
        const reqHeaders = (await this.getAuthToken())
          ? { Authorization: `Bearer ${await this.getAuthToken()}` }
          : ({} as any);
        return fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: reqHeaders,
          body: formData,
        });
      };

      let response = await buildRequest();

      // Same refresh dance as makeRequest: try to refresh on 401, retry
      // once, only nuke the session if the refresh is explicitly rejected.
      if (response.status === 401 && token) {
        const refreshResult = await this.attemptTokenRefresh();
        if (refreshResult === 'refreshed') {
          response = await buildRequest();
          if (response.status === 401) {
            await this.handleAuthFailure();
            return { success: false, error: 'Authentication expired. Please login again.' };
          }
        } else if (refreshResult === 'rejected') {
          await this.handleAuthFailure();
          return { success: false, error: 'Authentication expired. Please login again.' };
        } else {
          return { success: false, error: 'Authentication check failed. Please try again.' };
        }
      } else if (response.status === 401) {
        return { success: false, error: 'Authentication required.' };
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
      const response = await this.get<{ status: string }>('/health');
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
        });
      
      const token = await this.getAuthToken();
      if (!token) {
        console.log('❌ No token available for validation');
        return false;
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