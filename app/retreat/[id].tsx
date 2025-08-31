import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import retreatService from '@/services/retreatService';
import { Session } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBytes, estimateAudioFileSize } from '@/utils/fileSize';
import { API_ENDPOINTS, buildApiUrl } from '@/services/apiConfig';
import apiService from '@/services/apiService';
import downloadStateService, { DownloadState } from '@/services/downloadStateService';

const colors = {
  cream: {
    100: '#fcf8f3',
  },
  burgundy: {
    50: '#fef2f2',
    100: '#fde6e6',
    500: '#b91c1c',
    600: '#991b1b',
    700: '#7f1d1d',
  },
  saffron: {
    500: '#f59e0b',
  },
  gray: {
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
};

interface RetreatDetails {
  id: string;
  name: string;
  season: string;
  year: number;
  startDate: string;
  endDate: string;
  sessions: Session[];
  retreat_group: {
    id: string;
    name: string;
  };
}

export default function RetreatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const [retreat, setRetreat] = useState<RetreatDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadedTracks, setDownloadedTracks] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());
  const [downloadingTracks, setDownloadingTracks] = useState<Set<string>>(new Set());
  const [isDownloadingRetreat, setIsDownloadingRetreat] = useState(false);
  const [retreatDownloadProgress, setRetreatDownloadProgress] = useState({ completed: 0, total: 0, downloadedSize: 0, totalSize: 0 });
  const buttonOpacity = useRef(new Animated.Value(1)).current;
  const [downloadStateLoaded, setDownloadStateLoaded] = useState(false);
  
  // ZIP download state
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipDownloadProgress, setZipDownloadProgress] = useState<string>('');
  const [currentDownloadRequestId, setCurrentDownloadRequestId] = useState<string | null>(null);
  
  // Confirmation states for double-click removal
  const [retreatRemovalConfirmation, setRetreatRemovalConfirmation] = useState(false);
  const removalTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const initializeScreen = async () => {
      // First clean up any really old downloads (older than 30 minutes)
      await downloadStateService.forceCleanupStaleDownloads(0.5); // 30 minutes
      
      // Then load retreat details
      await loadRetreatDetails();
      
      // Finally try to recover valid download state
      await recoverDownloadState();
    };
    
    initializeScreen();
  }, [id]);
  
  useEffect(() => {
    if (retreat) {
      loadDownloadedTracks();
    }
  }, [retreat]);

  // Refresh download state when screen comes into focus (but not on initial load)
  const hasMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (retreat && hasMountedRef.current) {
        loadDownloadedTracks();
      }
      hasMountedRef.current = true;
    }, [retreat])
  );

  // Smooth transition when button state changes
  useEffect(() => {
    Animated.timing(buttonOpacity, {
      toValue: 0.7,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [downloadedTracks.size, isDownloadingRetreat]);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (removalTimeoutRef.current) {
        clearTimeout(removalTimeoutRef.current);
      }
    };
  }, []);

  const loadRetreatDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await retreatService.getRetreatDetails(id);
      if (response.success && response.data) {
        setRetreat(response.data);
      } else {
        setError(response.error || 'Failed to load retreat details');
      }
    } catch (err) {
      setError('Failed to load retreat details');
      console.error('Load retreat error:', err);
    } finally {
      setLoading(false);
    }
  };

  const recoverDownloadState = async () => {
    try {
      const existingDownload = await downloadStateService.getDownloadForRetreat(id);
      
      if (existingDownload) {
        console.log(`🔄 Recovering download state for retreat ${id}:`, existingDownload);
        
        // Check if download is too old (more than 20 minutes)
        const downloadAge = Date.now() - new Date(existingDownload.startedAt).getTime();
        const maxAge = 20 * 60 * 1000; // 20 minutes
        
        if (downloadAge > maxAge) {
          console.log(`🧹 Download too old (${Math.round(downloadAge / 60000)} min), cleaning up`);
          await downloadStateService.removeDownloadState(id);
          return; // Don't try to recover
        }
        
        setCurrentDownloadRequestId(existingDownload.requestId);
        
        if (existingDownload.status === 'processing' || existingDownload.status === 'pending') {
          // First check server status before resuming
          try {
            const statusResponse = await apiService.get(
              API_ENDPOINTS.DOWNLOAD_STATUS(existingDownload.requestId)
            );
            
            if (!statusResponse.success) {
              console.log(`⚠️ Cannot verify server status, cleaning up local state`);
              await downloadStateService.removeDownloadState(id);
              return;
            }
            
            const serverStatus = statusResponse.data?.status;
            console.log(`📊 Server status check: ${serverStatus}`);
            
            if (serverStatus === 'ready') {
              // Server says it's ready, clean up and don't resume
              await downloadStateService.removeDownloadState(id);
              return;
            } else if (serverStatus === 'failed' || serverStatus === 'expired') {
              // Server says it failed, clean up and don't resume  
              console.log(`❌ Server status is ${serverStatus}, cleaning up`);
              await downloadStateService.removeDownloadState(id);
              return;
            } else if (serverStatus === 'processing' || serverStatus === 'pending') {
              // Server confirms it's still processing, safe to resume
              setIsDownloadingZip(true);
              setZipDownloadProgress(existingDownload.progressMessage || 'Resuming ZIP generation...');
              resumeDownloadPolling(existingDownload.requestId);
            } else {
              // Unknown status, clean up to be safe
              console.log(`❓ Unknown server status: ${serverStatus}, cleaning up`);
              await downloadStateService.removeDownloadState(id);
              return;
            }
          } catch (statusError) {
            console.log(`⚠️ Failed to check server status:`, statusError);
            await downloadStateService.removeDownloadState(id);
            return;
          }
        } else if (existingDownload.status === 'ready') {
          // Download is ready, clean up the state
          await downloadStateService.removeDownloadState(id);
          setZipDownloadProgress('');
        }
      }
    } catch (error) {
      console.error('Failed to recover download state:', error);
      // Clean up on any recovery error
      await downloadStateService.removeDownloadState(id);
    }
  };

  const resumeDownloadPolling = async (requestId: string) => {
    try {
      console.log(`🔄 Resuming polling for download request: ${requestId}`);
      console.log('🗺️ Current isDownloadingZip state:', isDownloadingZip);
      
      // Ensure download state is active for polling
      if (!isDownloadingZip) {
        console.log('⚠️ isDownloadingZip was false, setting to true for polling');
        setIsDownloadingZip(true);
      }
      
      // Step 2: Poll for completion (same logic as original)
      let isComplete = false;
      let attempt = 0;
      const maxAttempts = 240; // 20 minutes max (5 second intervals) - for large retreats

      while (!isComplete && attempt < maxAttempts) {
        console.log(`🕰️ Polling attempt ${attempt + 1}/${maxAttempts} for request ${requestId}`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        console.log('📋 Making status request to:', API_ENDPOINTS.DOWNLOAD_STATUS(requestId));
        const statusResponse = await apiService.get(
          API_ENDPOINTS.DOWNLOAD_STATUS(requestId)
        );

        console.log('📋 Status response:', statusResponse);

        if (!statusResponse.success) {
          console.error('❌ Status check failed:', statusResponse.error);
          throw new Error(statusResponse.error || 'Failed to check ZIP status');
        }

        console.log(`📊 ZIP status check ${attempt + 1}:`, statusResponse.data);
        console.log('🔍 Status details:', {
          status: statusResponse.data?.status,
          progress_percent: statusResponse.data?.progress_percent,
          processed_files: statusResponse.data?.processed_files,
          total_files: statusResponse.data?.total_files,
          error_message: statusResponse.data?.error_message
        });

        if (statusResponse.data?.status === 'ready') {
          isComplete = true;
          
          setZipDownloadProgress('ZIP ready! Starting download...');
          
          // Update download state
          await downloadStateService.updateDownloadState(id, {
            status: 'ready',
            progressMessage: 'ZIP ready!'
          });
        } else if (statusResponse.data?.status === 'failed') {
          throw new Error(statusResponse.data?.error_message || 'ZIP generation failed');
        } else if (statusResponse.data?.status === 'processing') {
          // Use ONLY real progress data from Lambda, no fake progress
          const progressPercent = statusResponse.data.progress_percent;
          const filesInfo = statusResponse.data.processed_files && statusResponse.data.total_files 
            ? ` (${statusResponse.data.processed_files}/${statusResponse.data.total_files} files)`
            : '';
          
          let progressMsg;
          if (progressPercent !== undefined && progressPercent !== null) {
            progressMsg = `Generating ZIP... ${progressPercent}%${filesInfo}`;
          } else {
            progressMsg = `Generating ZIP file...${filesInfo}`;
          }
          
          setZipDownloadProgress(progressMsg);
          
          // Update download state
          await downloadStateService.updateDownloadState(id, {
            status: 'processing',
            progress: progressPercent,
            progressMessage: progressMsg
          });
        } else {
          // Simple pending status - no fake progress
          // If stuck in pending for too long, show more helpful message
          const pendingDuration = new Date().getTime() - new Date(statusResponse.data?.created_at).getTime();
          const minutesPending = Math.floor(pendingDuration / (1000 * 60));
          
          let progressMsg;
          if (minutesPending > 2) {
            progressMsg = `Waiting for ZIP generation... (${minutesPending} min) - Lambda may have issues`;
          } else {
            progressMsg = `Waiting for ZIP generation to start...`;
          }
          setZipDownloadProgress(progressMsg);
          
          await downloadStateService.updateDownloadState(id, {
            progressMessage: progressMsg
          });
        }

        attempt++;
      }

      if (!isComplete) {
        // Clean up timed out state before throwing error
        await downloadStateService.removeDownloadState(id);
        throw new Error('ZIP generation timed out - you can try again');
      }

      // Step 3: Download the ZIP file
      console.log(`⬇️ Getting presigned download URL for request: ${requestId}`);

      // Make authenticated API request to get presigned S3 URL
      const downloadResponse = await apiService.get(API_ENDPOINTS.DOWNLOAD_FILE(requestId));
      
      // Handle auto-recovery scenario where backend needs to regenerate file
      if (downloadResponse.data?.regenerating === true) {
        console.log(`🔄 ZIP file missing, auto-recovery initiated. New request: ${downloadResponse.data.new_request_id}`);
        
        // Update UI to show regeneration status
        setZipDownloadProgress('File missing - regenerating ZIP...');
        
        // Wait recommended time before polling new request
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second wait
        
        // Recursively call with new request ID to continue polling
        return await resumeZipDownloadPolling(downloadResponse.data.new_request_id);
      }
      
      if (!downloadResponse.data?.success || !downloadResponse.data?.download_url) {
        throw new Error('Failed to get download URL from server');
      }

      const presignedUrl = downloadResponse.data.download_url;
      const fileName = downloadResponse.data.file_name || `${retreat?.name}.zip`;
      
      console.log(`⬇️ Opening presigned S3 URL for download: ${fileName}`);
      
      // Open the presigned S3 URL (no authentication needed for S3)
      const { Linking } = require('react-native');
      await Linking.openURL(presignedUrl);

      console.log(`✅ ZIP download initiated for retreat: ${retreat?.name}`);
      
      // Clean up download state
      await downloadStateService.removeDownloadState(id);

    } catch (error) {
      console.error('Resume ZIP download error:', error);
      
      // Always clean up failed state to allow retry
      await downloadStateService.removeDownloadState(id);
      
      // Show user-friendly error message
      const errorMsg = error.message?.includes('timed out') 
        ? 'ZIP generation took too long. Please try again - the system will retry faster.'
        : error.message?.includes('regenerating')
        ? 'File regeneration failed. You can try downloading again.'
        : `Failed to resume ZIP download: ${error.message}`;
      
      Alert.alert('Download Error', errorMsg);
    } finally {
      setIsDownloadingZip(false);
      setZipDownloadProgress('');
      setCurrentDownloadRequestId(null);
    }
  };

  const loadDownloadedTracks = async () => {
    try {
      if (retreat?.sessions) {
        const downloadedTrackIds = new Set<string>();
        
        // Collect all tracks from all sessions
        const allTracks: any[] = [];
        retreat.sessions.forEach(session => {
          if (session.tracks) {
            allTracks.push(...session.tracks);
          }
        });
        
        // Check all tracks simultaneously for faster loading
        const downloadPromises = allTracks.map(async (track) => {
          const isDownloaded = await retreatService.isTrackDownloaded(track.id);
          return { trackId: track.id, isDownloaded };
        });
        
        const results = await Promise.all(downloadPromises);
        results.forEach(({ trackId, isDownloaded }) => {
          if (isDownloaded) {
            downloadedTrackIds.add(trackId);
          }
        });
        
        setDownloadedTracks(downloadedTrackIds);
        setDownloadStateLoaded(true);
        console.log(`📥 Found ${downloadedTrackIds.size} downloaded tracks in retreat`);
      }
    } catch (error) {
      console.error('Load downloaded tracks error:', error);
      setDownloadStateLoaded(true); // Set loaded even on error to prevent infinite loading
    }
  };

  // Helper function for confirmation system
  const resetRetreatRemovalConfirmation = () => {
    setRetreatRemovalConfirmation(false);
    if (removalTimeoutRef.current) {
      clearTimeout(removalTimeoutRef.current);
    }
  };

  const handleSessionPress = (sessionId: string) => {
    router.push(`/session/${sessionId}`);
  };

  const calculateSessionSize = (session: Session) => {
    if (!session.tracks) return 0;
    return session.tracks.reduce((total, track) => {
      return total + (track.file_size || estimateAudioFileSize(track.duration));
    }, 0);
  };

  const calculateTotalRetreatSize = (sessions: Session[]) => {
    return sessions.reduce((total, session) => {
      return total + calculateSessionSize(session);
    }, 0);
  };

  const formatSessionInfo = (session: Session) => {
    const tracksCount = session.tracks?.length || 0;
    const sessionSize = formatBytes(calculateSessionSize(session));
    return `${tracksCount} tracks • ${t(`retreats.${session.type}`)} • ${sessionSize}`;
  };

  const handleDownloadAllRetreat = async () => {
    try {
      if (!retreat) return;
      
      // Check if already downloading retreat
      if (isDownloadingRetreat) {
        // Cancel all active downloads
        for (const trackId of downloadingTracks) {
          await retreatService.cancelTrackDownload(trackId);
        }
        
        // Reset state
        setIsDownloadingRetreat(false);
        setRetreatDownloadProgress({ completed: 0, total: 0, downloadedSize: 0, totalSize: 0 });
        setDownloadingTracks(new Set());
        setDownloadProgress(new Map());
        return;
      }

      // Get all tracks from all sessions
      const allTracks: any[] = [];
      retreat.sessions.forEach(session => {
        if (session.tracks) {
          allTracks.push(...session.tracks);
        }
      });
      
      if (allTracks.length === 0) {
        Alert.alert('No Tracks', 'This retreat has no tracks to download.');
        return;
      }
      
      // Check if all tracks are downloaded - if so, remove them
      const tracksToDownload = allTracks.filter(track => !downloadedTracks.has(track.id));
      const tracksToRemove = allTracks.filter(track => downloadedTracks.has(track.id));
      
      if (tracksToDownload.length === 0 && tracksToRemove.length > 0) {
        // All tracks are downloaded - handle removal with double-click confirmation
        if (retreatRemovalConfirmation) {
          // Second click - execute removal
          console.log(`🗑️ Removing all downloads for retreat: ${retreat.name}`);
          resetRetreatRemovalConfirmation();
          
          for (const track of tracksToRemove) {
            const result = await retreatService.removeDownloadedTrack(track.id);
            if (result.success) {
              setDownloadedTracks(prev => {
                const newSet = new Set(prev);
                newSet.delete(track.id);
                return newSet;
              });
              console.log(`✅ Removed download: ${track.title}`);
            }
          }
          
          console.log(`🎉 All retreat downloads removed`);
          return;
        } else {
          // First click - enter confirmation state
          setRetreatRemovalConfirmation(true);
          removalTimeoutRef.current = setTimeout(() => {
            setRetreatRemovalConfirmation(false);
          }, 4000);
          return;
        }
      }
      
      if (tracksToDownload.length === 0) {
        console.log(`✅ All tracks already downloaded`);
        return;
      }

      console.log(`🔽 Starting bulk download for retreat: ${retreat.name}`);
      
      setIsDownloadingRetreat(true);
      const totalSize = tracksToDownload.reduce((sum, track) => 
        sum + (track.file_size || estimateAudioFileSize(track.duration)), 0);
      setRetreatDownloadProgress({ completed: 0, total: tracksToDownload.length, downloadedSize: 0, totalSize });
      
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < tracksToDownload.length; i++) {
        const track = tracksToDownload[i];
        console.log(`📊 Downloading track ${i + 1}/${tracksToDownload.length}: ${track.title}`);
        
        // Mark track as downloading
        setDownloadingTracks(prev => new Set(prev).add(track.id));
        
        const result = await retreatService.downloadTrack(track.id, (progress) => {
          setDownloadProgress(prev => new Map(prev).set(track.id, progress));
        });
        
        // Clean up track downloading state
        setDownloadingTracks(prev => {
          const newSet = new Set(prev);
          newSet.delete(track.id);
          return newSet;
        });
        setDownloadProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(track.id);
          return newMap;
        });
        
        if (result.success && !result.cancelled) {
          successCount++;
          setDownloadedTracks(prev => new Set(prev).add(track.id));
          console.log(`✅ Track downloaded: ${track.title} (${successCount}/${tracksToDownload.length})`);
        } else if (result.cancelled) {
          console.log(`⏸️ Track download cancelled: ${track.title}`);
          break; // Exit the loop if download was cancelled
        } else {
          failCount++;
          console.error(`❌ Failed to download track ${track.title}:`, result.error);
        }
        
        // Update retreat progress
        const downloadedSize = tracksToDownload.slice(0, i + 1).reduce((sum, track) => 
          sum + (track.file_size || estimateAudioFileSize(track.duration)), 0);
        setRetreatDownloadProgress({ 
          completed: i + 1, 
          total: tracksToDownload.length,
          downloadedSize,
          totalSize
        });
      }
      
      setIsDownloadingRetreat(false);
      setRetreatDownloadProgress({ completed: 0, total: 0, downloadedSize: 0, totalSize: 0 });
      
      console.log(`🎉 Retreat download completed: ${successCount} succeeded, ${failCount} failed`);
      
    } catch (error) {
      setIsDownloadingRetreat(false);
      setRetreatDownloadProgress({ completed: 0, total: 0, downloadedSize: 0, totalSize: 0 });
      console.error('Bulk retreat download error:', error);
    }
  };

  const handleDownloadRetreatZip = async () => {
    try {
      if (!retreat) return;

      console.log('🗂️ ZIP download requested for retreat:', retreat.name);

      // Check for existing download first
      const existingDownload = await downloadStateService.getDownloadForRetreat(retreat.id);
      console.log('📋 Existing download state:', existingDownload);
      
      if (isDownloadingZip || existingDownload) {
        if (existingDownload && ['pending', 'processing'].includes(existingDownload.status)) {
          // Check if download is stale (older than 10 minutes) or user wants to force retry
          const downloadAge = Date.now() - new Date(existingDownload.startedAt).getTime();
          const maxAge = 10 * 60 * 1000; // 10 minutes
          
          if (downloadAge > maxAge) {
            console.log(`🧹 Cleaning up stale download (${Math.round(downloadAge / 60000)} minutes old)`);
            await downloadStateService.removeDownloadState(retreat.id);
            setIsDownloadingZip(false);
            setZipDownloadProgress('');
            // Continue with new download
          } else if (isDownloadingZip) {
            // User clicked while download in progress - cancel directly without confirmation
            console.log('🔄 User requested cancel');
            await downloadStateService.removeDownloadState(retreat.id);
            setIsDownloadingZip(false);
            setZipDownloadProgress('');
            setCurrentDownloadRequestId(null);
            return;
          } else {
            // State exists but not currently downloading - resume
            console.log('📱 Resuming existing download');
            setIsDownloadingZip(true);
            setCurrentDownloadRequestId(existingDownload.requestId);
            setZipDownloadProgress(existingDownload.progressMessage || 'Resuming...');
            resumeDownloadPolling(existingDownload.requestId);
            return;
          }
        } else {
          // Cancel current operation
          setIsDownloadingZip(false);
          setZipDownloadProgress('');
          await downloadStateService.removeDownloadState(retreat.id);
          // Continue with new download
        }
      }

      console.log(`🗂️ Starting ZIP download for retreat: ${retreat.name} (ID: ${retreat.id})`);
      
      // Validate retreat ID
      if (!retreat.id) {
        throw new Error('Retreat ID is missing');
      }
      
      setIsDownloadingZip(true);
      setZipDownloadProgress('Requesting ZIP generation...');

      // Step 1: Request ZIP generation
      console.log('🔍 Retreat ID type and value:', typeof retreat.id, retreat.id);
      console.log('🔍 Retreat ID as string:', String(retreat.id));
      
      const downloadEndpoint = API_ENDPOINTS.RETREAT_DOWNLOAD_REQUEST(retreat.id);
      console.log('📋 Making ZIP API request to:', downloadEndpoint);
      console.log('🗺️ Full URL will be:', require('@/services/apiConfig').API_CONFIG.baseURL + downloadEndpoint);
      
      // TEST: Try to get auth token first to verify authentication
      const authToken = await AsyncStorage.getItem('auth_token');
      console.log('🔑 Auth token status:', authToken ? 'Present' : 'Missing');
      console.log('🔑 Auth token length:', authToken?.length || 0);
      
      // TEST: Quick connectivity check - try user retreats endpoint instead of health
      console.log('🌐 Testing basic API connectivity first...');
      try {
        const connectivityTest = await apiService.get(API_ENDPOINTS.USER_RETREATS);
        console.log('🏥 Connectivity test result:', connectivityTest);
        console.log('🏥 Connectivity success:', connectivityTest.success);
      } catch (connectivityError) {
        console.error('🏥 Connectivity test failed:', connectivityError);
      }
      
      console.log('📡 Making ZIP API request now...');
      const requestResponse = await apiService.post(downloadEndpoint);

      console.log('📋 ZIP API response:', requestResponse);
      console.log('📋 ZIP API response success:', requestResponse.success);
      console.log('📋 ZIP API response error:', requestResponse.error);
      console.log('📋 ZIP API response data:', requestResponse.data);

      if (!requestResponse.success) {
        throw new Error(requestResponse.error || 'Failed to request ZIP generation');
      }

      const requestId = requestResponse.data?.request_id;
      console.log('📋 Request ID from server:', requestId);
      
      if (!requestId) {
        throw new Error('No request ID received');
      }

      console.log(`📋 ZIP request created with ID: ${requestId}`);
      setCurrentDownloadRequestId(requestId);
      
      // Save download state to persistent storage
      const downloadState: DownloadState = {
        requestId,
        retreatId: retreat.id,
        retreatName: retreat.name,
        status: 'pending',
        startedAt: new Date().toISOString(),
        progressMessage: 'Generating ZIP file...'
      };
      
      await downloadStateService.saveDownloadState(downloadState);
      setZipDownloadProgress('Generating ZIP file...');

      // Step 2: Use the same polling logic as resumeDownloadPolling
      console.log('🔄 Starting polling for request:', requestId);
      console.log('🔄 isDownloadingZip state before polling:', isDownloadingZip);
      await resumeDownloadPolling(requestId);

    } catch (error) {
      console.error('ZIP download error:', error);
      
      // Always clean up on error to allow retry
      await downloadStateService.removeDownloadState(retreat.id);
      setIsDownloadingZip(false);
      setZipDownloadProgress('');
      setCurrentDownloadRequestId(null);
      
      // Show user-friendly error message
      const errorMsg = error.message?.includes('timed out') 
        ? 'ZIP generation took too long. The system is optimized now - please try again.'
        : error.message?.includes('regenerating')
        ? 'File was missing and regeneration failed. Please try again - the system will create a fresh copy.'
        : `Failed to download ZIP: ${error.message}`;
      
      Alert.alert('Download Error', errorMsg);
    }
  };

  const handleDownloadRetreatZipDirect = async () => {
    try {
      if (!retreat) return;

      console.log('🚪 DIRECT ZIP download (no state checks) for retreat:', retreat.name, '(ID:', retreat.id, ')');
      
      // Validate retreat ID
      if (!retreat.id) {
        throw new Error('Retreat ID is missing for direct request');
      }
      
      setIsDownloadingZip(true);
      setZipDownloadProgress('Requesting ZIP generation (direct)...');

      // Make direct API request
      const directEndpoint = API_ENDPOINTS.RETREAT_DOWNLOAD_REQUEST(retreat.id);
      console.log('📋 Making DIRECT API request to:', directEndpoint);
      console.log('🗺️ DIRECT Full URL:', require('@/services/apiConfig').API_CONFIG.baseURL + directEndpoint);
      
      const requestResponse = await apiService.post(directEndpoint);

      console.log('📋 DIRECT API response:', requestResponse);
      console.log('📋 DIRECT API success:', requestResponse.success);
      console.log('📋 DIRECT API error:', requestResponse.error);

      if (!requestResponse.success) {
        throw new Error(requestResponse.error || 'Direct API request failed');
      }

      const requestId = requestResponse.data?.request_id;
      console.log('📋 DIRECT Request ID from server:', requestId);
      
      if (!requestId) {
        throw new Error('No request ID received from direct request');
      }

      console.log(`📋 DIRECT ZIP request created with ID: ${requestId}`);
      setCurrentDownloadRequestId(requestId);
      
      // Save download state
      const downloadState: DownloadState = {
        requestId,
        retreatId: retreat.id,
        retreatName: retreat.name,
        status: 'pending',
        startedAt: new Date().toISOString(),
        progressMessage: 'Generating ZIP file (direct)...'
      };
      
      await downloadStateService.saveDownloadState(downloadState);
      setZipDownloadProgress('Generating ZIP file (direct)...');

      // Start polling
      console.log('🔄 Starting DIRECT polling for request:', requestId);
      await resumeDownloadPolling(requestId);

    } catch (error) {
      console.error('DIRECT ZIP download error:', error);
      
      // Clean up on error
      await downloadStateService.removeDownloadState(retreat.id);
      setIsDownloadingZip(false);
      setZipDownloadProgress('');
      setCurrentDownloadRequestId(null);
      
      Alert.alert('Direct Download Error', `Direct download failed: ${error.message}`);
    }
  };

  if (loading || !downloadStateLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>
            {loading ? 'Loading retreat...' : 'Loading download status...'}
          </Text>
        </View>
      </View>
    );
  }

  if (error || !retreat) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Retreat not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed Header Section - unmovable */}
      <SafeAreaView edges={['top']} style={styles.fixedHeaderContainer}>
        {/* Navigation Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.burgundy[500]} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{retreat.name}</Text>
            <Text style={styles.headerSubtitle}>
              {t(`retreats.${retreat.season}`)} {retreat.year}
            </Text>
          </View>
        </View>

        {/* Download Retreat Buttons */}
        <View style={styles.retreatActions}>
          {/* Individual Files Download Button */}
          <Animated.View style={{ opacity: buttonOpacity }}>
            <TouchableOpacity
              onPress={handleDownloadAllRetreat}
              style={[
                (() => {
                  const allTracks: any[] = [];
                  retreat.sessions.forEach(session => {
                    if (session.tracks) {
                      allTracks.push(...session.tracks);
                    }
                  });
                  const tracksToDownload = allTracks.filter(t => !downloadedTracks.has(t.id));
                  const tracksDownloaded = allTracks.filter(t => downloadedTracks.has(t.id));
                  const allDownloaded = tracksToDownload.length === 0 && tracksDownloaded.length > 0;
                  
                  if (isDownloadingRetreat) {
                    return styles.downloadAllButtonActive;
                  } else if (allDownloaded && retreatRemovalConfirmation) {
                    return styles.confirmRemovalButton;
                  } else if (allDownloaded) {
                    return styles.removeAllButton;
                  } else {
                    return styles.downloadAllButton;
                  }
                })(),
                { marginBottom: 8 }
              ]}
            >
            {isDownloadingRetreat ? (
              <>
                <ActivityIndicator size="small" color="white" style={styles.downloadSpinner} />
                <View style={styles.downloadProgressContainer}>
                  <Text style={styles.downloadAllButtonText}>
                    {retreatDownloadProgress.total > 0 
                      ? `${Math.round((retreatDownloadProgress.completed / retreatDownloadProgress.total) * 100)}%`
                      : 'Preparing...'
                    }
                  </Text>
                  {retreatDownloadProgress.totalSize > 0 && (
                    <Text style={styles.downloadSizeText}>
                      {formatBytes(retreatDownloadProgress.downloadedSize)} / {formatBytes(retreatDownloadProgress.totalSize)}
                    </Text>
                  )}
                </View>
              </>
            ) : (() => {
              const allTracks: any[] = [];
              retreat.sessions.forEach(session => {
                if (session.tracks) {
                  allTracks.push(...session.tracks);
                }
              });
              const tracksToDownload = allTracks.filter(t => !downloadedTracks.has(t.id));
              const tracksDownloaded = allTracks.filter(t => downloadedTracks.has(t.id));
              const allDownloaded = tracksToDownload.length === 0 && tracksDownloaded.length > 0;
              
              const totalSizeToDownload = formatBytes(tracksToDownload.reduce((total, track) => 
                total + (track.file_size || estimateAudioFileSize(track.duration)), 0));
              const totalSizeDownloaded = formatBytes(tracksDownloaded.reduce((total, track) => 
                total + (track.file_size || estimateAudioFileSize(track.duration)), 0));
              
              // Handle confirmation state for removal
              if (allDownloaded && retreatRemovalConfirmation) {
                return (
                  <>
                    <Ionicons name="warning" size={20} color={colors.saffron[500]} />
                    <Text style={styles.confirmRemovalButtonText}>
                      Tap again to confirm removal
                    </Text>
                  </>
                );
              }
              
              return (
                <>
                  <Ionicons 
                    name={allDownloaded ? "trash-outline" : "download"} 
                    size={20} 
                    color={allDownloaded ? colors.gray[600] : "white"} 
                  />
                  <Text style={allDownloaded ? styles.removeAllButtonText : styles.downloadAllButtonText}>
                    {allDownloaded 
                      ? `Remove Downloads (${tracksDownloaded.length} tracks, ${totalSizeDownloaded})`
                      : `${t('common.download')} (${tracksToDownload.length} tracks, ${totalSizeToDownload})`
                    }
                  </Text>
                </>
              );
            })()}
            </TouchableOpacity>
          </Animated.View>

          {/* ZIP Download Button */}
          <TouchableOpacity
            onPress={() => handleDownloadRetreatZip()}
            style={[
              styles.zipDownloadButton,
              isDownloadingZip && styles.zipDownloadButtonActive
            ]}
            disabled={false}  // Always allow press for retry functionality
          >
            {isDownloadingZip ? (
              <>
                <ActivityIndicator size="small" color={colors.burgundy[500]} style={{ marginRight: 8 }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={styles.zipDownloadButtonText}>
                    {zipDownloadProgress || 'Preparing...'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="archive-outline" size={20} color={colors.burgundy[500]} />
                <Text style={styles.zipDownloadButtonText}>
                  {t('common.downloadRetreatZip')}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
        </View>

        {/* Sessions Header */}
        <View style={styles.sessionsHeaderSection}>
          <Text style={styles.sessionsTitle}>
            {t('retreats.sessions')} ({retreat.sessions.length})
          </Text>
        </View>
      </SafeAreaView>

      {/* Scrollable Sessions List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {retreat.sessions
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((session) => {
              return (
                <TouchableOpacity
                  key={session.id}
                  onPress={() => handleSessionPress(session.id)}
                  style={styles.sessionCard}
                >
                  <View style={styles.borderAccent} />
                  <View style={styles.cardContent}>
                    <Text style={styles.sessionName}>{session.name}</Text>
                    <Text style={styles.sessionInfo}>
                      {formatSessionInfo(session)}
                    </Text>
                    <Text style={styles.sessionDate}>
                      {new Date(session.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons 
                    name="chevron-forward" 
                    size={20} 
                    color={colors.gray[400]} 
                  />
                </TouchableOpacity>
              );
            })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  fixedHeaderContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  backButtonText: {
    color: colors.burgundy[500],
    fontSize: 16,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.burgundy[500],
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.gray[600],
    marginTop: 2,
  },
  content: {
    flex: 1,
    backgroundColor: colors.cream[100],
  },
  scrollContent: {
    padding: 16,
  },
  retreatActions: {
    padding: 16,
    backgroundColor: 'white',
  },
  sessionsHeaderSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  downloadAllButton: {
    backgroundColor: colors.burgundy[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  downloadAllButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  downloadAllButtonActive: {
    backgroundColor: colors.burgundy[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    opacity: 0.9,
  },
  removeAllButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.gray[300],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  removeAllButtonText: {
    color: colors.gray[600],
    fontSize: 16,
    fontWeight: '600',
  },
  downloadSpinner: {
    marginRight: 8,
  },
  downloadProgressContainer: {
    alignItems: 'center',
  },
  downloadSizeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  confirmRemovalButton: {
    backgroundColor: colors.saffron[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.saffron[500],
  },
  confirmRemovalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  sessionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  sessionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    position: 'relative',
  },
  borderAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.burgundy[500],
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  cardContent: {
    flex: 1,
    paddingLeft: 8,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.burgundy[500],
    marginBottom: 4,
  },
  sessionInfo: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 2,
  },
  sessionDate: {
    fontSize: 12,
    color: colors.gray[500],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    color: colors.gray[600],
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: colors.gray[600],
    marginBottom: 20,
  },
  zipDownloadButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.burgundy[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  zipDownloadButtonActive: {
    backgroundColor: colors.burgundy[50],
    borderColor: colors.burgundy[600],
    opacity: 0.8,
  },
  zipDownloadButtonText: {
    color: colors.burgundy[500],
    fontSize: 16,
    fontWeight: '600',
  },
});