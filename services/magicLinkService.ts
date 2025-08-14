import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import apiService from './apiService';
import { API_ENDPOINTS } from './apiConfig';

interface DeviceInfo {
  fingerprint: string;
  name: string;
  type: string;
}

interface MagicLinkResponse {
  status: 'magic_link_sent' | 'already_activated' | 'approval_required';
  message: string;
  access_token?: string;
  refresh_token?: string;
  user?: any;
  expires_in?: number;
  email?: string;
}

interface ApprovalResponse {
  status: 'approval_requested' | 'already_pending';
  message: string;
}

interface ActivationResponse {
  status: 'device_activated' | 'token_invalid';
  message: string;
  access_token?: string;
  refresh_token?: string;
  user?: any;
  device_activation?: any;
  error?: string;
}

class MagicLinkService {
  private static instance: MagicLinkService;
  
  static getInstance(): MagicLinkService {
    if (!MagicLinkService.instance) {
      MagicLinkService.instance = new MagicLinkService();
    }
    return MagicLinkService.instance;
  }

  /**
   * React Native compatible base64 encoding
   */
  private encodeBase64(str: string): string {
    try {
      // For React Native/Expo, we can use btoa if available (web)
      if (typeof btoa !== 'undefined') {
        return btoa(str);
      }
      
      // Fallback for environments without btoa
      // Simple base64 encoding for React Native
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      let i = 0;
      
      while (i < str.length) {
        const a = str.charCodeAt(i++);
        const b = i < str.length ? str.charCodeAt(i++) : 0;
        const c = i < str.length ? str.charCodeAt(i++) : 0;
        
        const bitmap = (a << 16) | (b << 8) | c;
        
        result += chars.charAt((bitmap >> 18) & 63);
        result += chars.charAt((bitmap >> 12) & 63);
        result += i - 2 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
        result += i - 1 < str.length ? chars.charAt(bitmap & 63) : '=';
      }
      
      return result;
    } catch (error) {
      console.error('Error encoding base64:', error);
      // Fallback to simple string hash
      return str.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0).toString(36);
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

  private async safeMultiRemove(keys: string[]): Promise<boolean> {
    try {
      await AsyncStorage.multiRemove(keys);
      return true;
    } catch (error) {
      console.error(`Error removing AsyncStorage items:`, error);
      // Try removing items individually as fallback
      for (const key of keys) {
        try {
          await AsyncStorage.removeItem(key);
        } catch (individualError) {
          console.error(`Failed to remove ${key}:`, individualError);
        }
      }
      return false;
    }
  }

  /**
   * Generate a unique device fingerprint with enhanced error handling
   */
  private async generateDeviceFingerprint(): Promise<string> {
    try {
      console.log('📱 Generating device fingerprint...');
      let fingerprint = await this.safeGetItem('device_fingerprint');
      
      if (!fingerprint) {
        // Create unique fingerprint combining device info
        const deviceInfo = {
          platform: Platform.OS,
          brand: Device.brand || 'unknown',
          modelName: Device.modelName || 'unknown',
          osVersion: Device.osVersion || 'unknown',
          timestamp: Date.now(),
          random: Math.random().toString(36).substring(2)
        };
        
        fingerprint = this.encodeBase64(JSON.stringify(deviceInfo));
        const saved = await this.safeSetItem('device_fingerprint', fingerprint);
        
        if (!saved) {
          console.warn('Failed to save device fingerprint, using session-only fingerprint');
          // Use a session-only fingerprint that doesn't persist
          fingerprint = `session-${this.encodeBase64(JSON.stringify(deviceInfo))}`;
        }
        
        console.log('📱 Generated new device fingerprint');
      } else {
        console.log('📱 Using existing device fingerprint');
      }
      
      return fingerprint;
    } catch (error) {
      console.error('Error generating device fingerprint:', error);
      // Fallback fingerprint
      const fallback = `${Platform.OS}-${Date.now()}-${Math.random().toString(36)}`;
      console.log('📱 Using fallback fingerprint');
      return fallback;
    }
  }

  /**
   * Get device information for API calls
   */
  private async getDeviceInfo(): Promise<DeviceInfo> {
    const fingerprint = await this.generateDeviceFingerprint();
    
    // Generate friendly device name
    let deviceName = 'Unknown Device';
    if (Device.deviceName) {
      deviceName = Device.deviceName;
    } else if (Device.modelName) {
      deviceName = Device.modelName;
    } else {
      deviceName = `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} Device`;
    }
    
    return {
      fingerprint,
      name: deviceName,
      type: Platform.OS
    };
  }

  /**
   * Step 1: Request magic link via email
   */
  async requestMagicLink(email: string): Promise<{ success: boolean; data?: MagicLinkResponse; error?: string }> {
    try {
      console.log('Requesting magic link for email:', email);
      
      const deviceInfo = await this.getDeviceInfo();
      
      const response = await apiService.post<MagicLinkResponse>(API_ENDPOINTS.REQUEST_MAGIC_LINK, {
        email: email.toLowerCase().trim(),
        device_fingerprint: deviceInfo.fingerprint,
        device_name: deviceInfo.name,
        device_type: deviceInfo.type
      });

      if (!response.success || !response.data) {
        return { 
          success: false, 
          error: response.error || 'Failed to request magic link' 
        };
      }

      // If device already activated, store tokens and activation flags
      if (response.data.status === 'already_activated' && response.data.access_token) {
        const storageResults = await Promise.all([
          this.safeSetItem('auth_token', response.data.access_token),
          this.safeSetItem('refresh_token', response.data.refresh_token || ''),
          this.safeSetItem('user_data', JSON.stringify(response.data.user)),
          this.safeSetItem('device_activated', 'true'),
          this.safeSetItem('activation_date', new Date().toISOString())
        ]);
        
        if (!storageResults.every(result => result)) {
          console.warn('Some activation tokens failed to save to AsyncStorage');
        }
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error requesting magic link:', error);
      
      
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  /**
   * Step 2b: Request admin approval for new users
   */
  async requestApproval(data: {
    email: string;
    first_name: string;
    last_name: string;
    message?: string;
  }): Promise<{ success: boolean; data?: ApprovalResponse; error?: string }> {
    try {
      console.log('Requesting approval for:', data.email);
      
      const deviceInfo = await this.getDeviceInfo();
      
      const response = await apiService.post<ApprovalResponse>(API_ENDPOINTS.REQUEST_USER_APPROVAL, {
        ...data,
        device_fingerprint: deviceInfo.fingerprint,
        device_name: deviceInfo.name,
        device_type: deviceInfo.type
      });

      if (!response.success || !response.data) {
        return { 
          success: false, 
          error: response.error || 'Failed to request approval' 
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error requesting approval:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  /**
   * Step 3: Activate device using magic link token
   */
  async activateDevice(token: string): Promise<{ success: boolean; data?: ActivationResponse; error?: string }> {
    try {
      console.log('Activating device with token');
      
      const response = await apiService.post<ActivationResponse>(
        API_ENDPOINTS.ACTIVATE_DEVICE.replace('<token>', token)
      );

      if (!response.success || !response.data) {
        
        return { 
          success: false, 
          error: response.error || 'Failed to activate device' 
        };
      }

      // Store tokens if activation successful
      if (response.data.status === 'device_activated' && response.data.access_token) {
        const storageResults = await Promise.all([
          this.safeSetItem('auth_token', response.data.access_token),
          this.safeSetItem('refresh_token', response.data.refresh_token || ''),
          this.safeSetItem('user_data', JSON.stringify(response.data.user)),
          this.safeSetItem('device_activated', 'true'),
          this.safeSetItem('activation_date', new Date().toISOString())
        ]);
        
        if (!storageResults.every(result => result)) {
          console.warn('Some device activation data failed to save to AsyncStorage');
        } else {
          console.log('✅ Device activation data saved successfully');
        }
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error activating device:', error);
      
      
      return { success: false, error: 'Activation failed. Please try again.' };
    }
  }

  /**
   * Check if current device is activated with enhanced error handling
   */
  async isDeviceActivated(): Promise<boolean> {
    try {
      console.log('📱 Checking device activation status...');
      
      const [activated, token] = await Promise.all([
        this.safeGetItem('device_activated'),
        this.safeGetItem('auth_token')
      ]);
      
      const isActivated = activated === 'true' && !!token;
      console.log('📱 Device activation status:', {
        activated: activated === 'true',
        hasToken: !!token,
        isActivated,
        rawActivated: activated,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'none'
      });
      
      return isActivated;
    } catch (error) {
      console.error('Error checking device activation:', error);
      return false;
    }
  }

  /**
   * Get device activation info with enhanced error handling
   */
  async getDeviceActivationInfo(): Promise<{ 
    isActivated: boolean; 
    activationDate?: string; 
    deviceInfo?: DeviceInfo 
  }> {
    try {
      console.log('📱 Getting device activation info...');
      
      const [isActivated, activationDate, deviceInfo] = await Promise.all([
        this.isDeviceActivated(),
        this.safeGetItem('activation_date'),
        this.getDeviceInfo()
      ]);
      
      const result = {
        isActivated,
        activationDate: activationDate || undefined,
        deviceInfo
      };
      
      console.log('📱 Device activation info:', result);
      return result;
    } catch (error) {
      console.error('Error getting activation info:', error);
      return { isActivated: false };
    }
  }

  /**
   * Deactivate device on backend (for logout)
   */
  async deactivateDeviceOnBackend(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🌐 Deactivating device on backend...');
      
      const deviceInfo = await this.getDeviceInfo();
      
      // Call backend to deactivate this device
      const response = await apiService.post<{ status: string; message: string }>(
        API_ENDPOINTS.DEACTIVATE_DEVICE, 
        {
          device_fingerprint: deviceInfo.fingerprint
        }
      );
      
      if (response.success) {
        console.log('✅ Device deactivated on backend:', response.data?.message);
        return { success: true };
      } else {
        console.warn('⚠️ Backend device deactivation failed:', response.error);
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.error('Error deactivating device on backend:', error);
      return { success: false, error: 'Failed to contact backend for deactivation' };
    }
  }

  /**
   * Clear device activation (for logout) with enhanced error handling
   * Note: Backend deactivation should be called separately BEFORE this method
   */
  async clearDeviceActivation(): Promise<void> {
    try {
      console.log('📱 Clearing local device activation data...');
      
      const success = await this.safeMultiRemove([
        'device_activated',
        'activation_date',
        'auth_token',
        'refresh_token',
        'user_data'
      ]);
      
      if (success) {
        console.log('✅ Device activation cleared successfully');
      } else {
        console.warn('⚠️ Some activation data may not have been cleared');
      }
    } catch (error) {
      console.error('Error clearing activation:', error);
    }
  }

  /**
   * Check activation status by polling backend for device activation
   * This is needed because magic link activation happens in browser, not in the app
   */
  async checkActivationStatus(): Promise<{ success: boolean; data?: { isActivated: boolean; user?: any }; error?: string }> {
    try {
      console.log('🔍 Checking activation status with backend...');
      
      // First check local status
      const isLocallyActivated = await this.isDeviceActivated();
      if (isLocallyActivated) {
        console.log('✅ Already activated locally');
        const userData = await this.safeGetItem('user_data');
        const user = userData ? JSON.parse(userData) : null;
        return {
          success: true,
          data: {
            isActivated: true,
            user: user
          }
        };
      }

      // Use device discovery endpoint to safely check activation status
      // This endpoint doesn't require auth tokens and can detect backend activations
      console.log('🔍 Using device discovery to check activation status...');
      const deviceInfo = await this.getDeviceInfo();
      
      const response = await apiService.post<{
        status?: string;
        message?: string;
        access_token?: string;
        refresh_token?: string;
        user?: any;
        device?: {
          activated_at?: string;
          device_fingerprint?: string;
          device_name?: string;
          user_name?: string;
          is_active?: boolean;
        };
      }>(API_ENDPOINTS.DISCOVER_DEVICE_ACTIVATION, {
        device_fingerprint: deviceInfo.fingerprint
      });

      if (response.success && response.data) {
        console.log('✅ Device discovery check successful:', response.data);
        
        const isActivated = response.data.status === 'activated';
        
        if (isActivated && response.data.access_token) {
          console.log('🎉 Device discovered as activated on backend - storing tokens');
          
          const storageResults = await Promise.all([
            this.safeSetItem('auth_token', response.data.access_token),
            this.safeSetItem('refresh_token', response.data.refresh_token || ''),
            this.safeSetItem('user_data', JSON.stringify(response.data.user)),
            this.safeSetItem('device_activated', 'true'),
            this.safeSetItem('activation_date', response.data.device?.activated_at || new Date().toISOString())
          ]);
          
          if (storageResults.every(result => result)) {
            console.log('✅ Discovered activation tokens stored locally');
            return {
              success: true,
              data: {
                isActivated: true,
                user: response.data.user
              }
            };
          } else {
            console.warn('⚠️ Some tokens failed to store locally');
            return {
              success: false,
              error: 'Failed to store activation tokens'
            };
          }
        } else if (response.data.status === 'not_activated') {
          console.log('🔍 Device not yet activated on backend');
          return {
            success: true,
            data: {
              isActivated: false
            }
          };
        } else {
          console.warn('⚠️ Unexpected discovery response status:', response.data.status);
          return {
            success: true,
            data: {
              isActivated: false
            }
          };
        }
      } else {
        console.warn('❌ Device discovery check failed:', response.error);
        
        // Fallback to local check in case of backend issues
        const isLocallyActivated = await this.isDeviceActivated();
        const userData = await this.safeGetItem('user_data');
        const user = userData ? JSON.parse(userData) : null;
        
        return {
          success: true,
          data: {
            isActivated: isLocallyActivated,
            user: user
          }
        };
      }
    } catch (error) {
      console.error('Error checking activation status:', error);
      
      // Fallback to local check
      const isActivated = await this.isDeviceActivated();
      const userData = await this.safeGetItem('user_data');
      const user = userData ? JSON.parse(userData) : null;
      
      return {
        success: true,
        data: {
          isActivated: isActivated && !!user,
          user: user
        }
      };
    }
  }

  /**
   * Parse magic link URL to extract token
   */
  parseActivationLink(url: string): string | null {
    try {
      const regex = /\/activate\/([a-zA-Z0-9_-]+)/;
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch (error) {
      console.error('Error parsing activation link:', error);
      return null;
    }
  }
}

export default MagicLinkService.getInstance();