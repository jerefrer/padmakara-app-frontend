import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Pressable, Platform, Alert, Image, RefreshControl } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';
import { groupHeroCacheKey, teacherHeroCacheKey } from '@/utils/cacheKeys';
import { selectHero } from '@/utils/heroVariant';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const HERO_HEIGHT = 380;
const HERO_COLLAPSE_END = 320;
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AudioPlayer } from '@/components/AudioPlayer';
import { VideoPlayer } from '@/components/VideoPlayer';
import { AnimatedPlayingBars } from '@/components/AnimatedPlayingBars';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import retreatService from '@/services/retreatService';
import downloadService from '@/services/downloadService';
import { ConfirmationModal, ConfirmationButton } from '@/components/ConfirmationModal';
import { OfflineBadge } from '@/components/OfflineBadge';
import { Session, Track, UserProgress } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { TrackDetailPanel } from '@/components/desktop/TrackDetailPanel';
import { useRelatedEvents } from '@/contexts/RelatedEventsContext';
import { ReadAlongViewer } from '@/components/ReadAlongViewer';
import { VideoGrid } from '@/components/VideoGrid';
import { getTranslatedName } from '@/utils/i18n';
import { formatBytes, estimateAudioFileSize } from '@/utils/fileSize';
import { API_ENDPOINTS } from '@/services/apiConfig';
import apiService from '@/services/apiService';
import downloadStateService, { DownloadState } from '@/services/downloadStateService';
import eventBookmarkService from '@/services/eventBookmarkService';
import trackBookmarkService from '@/services/trackBookmarkService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  filterTracksByLanguage,
  sortTracksForSession,
  type ContentLanguageMode,
  type TrackWithSession,
} from '@/utils/trackFiltering';

const colors = {
  cream: {
    100: '#ffffff',
  },
  burgundy: {
    50: '#f8f1f1',
    100: '#f2e0e0',
    500: '#9b1b1b',
    600: '#7b1616',
    700: '#5a1111',
  },
  saffron: {
    50: '#fffbeb',
    500: '#f59e0b',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
  },
  white: '#ffffff',
};

const LANG_COLORS: Record<string, { bg: string; text: string }> = {
  en: { bg: 'transparent', text: '#6b7fad' },
  pt: { bg: 'transparent', text: '#5a8a6a' },
  fr: { bg: 'transparent', text: '#8a6aad' },
  tib: { bg: 'transparent', text: '#9a7a4a' },
};
const DEFAULT_LANG_COLOR = { bg: 'transparent', text: colors.gray[500] };

const langBadgeColor = (lang: string) => ({
  backgroundColor: (LANG_COLORS[lang.toLowerCase()] || DEFAULT_LANG_COLOR).bg,
});
const langBadgeTextColor = (lang: string) => ({
  color: (LANG_COLORS[lang.toLowerCase()] || DEFAULT_LANG_COLOR).text,
});

interface TranscriptInfo {
  id: number;
  language: string;
  pageCount?: number;
  updatedAt?: string;
  originalFilename?: string;
}

/** Format an ISO date as "12 November 2025" / "12 de novembro de 2025". */
function formatLongDate(dateStr: string, language: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface RetreatDetails {
  id: string;
  name: string;
  name_translations?: Record<string, string>;
  season: string;
  year: number;
  startDate: string;
  endDate: string;
  sessions: Session[];
  teachers?: Array<{
    id?: number;
    name: string;
    abbreviation: string;
    photoUrl?: string | null;
    avatarUrl?: string | null;
    heroUrl?: string | null;
    heroFocalX?: number;
    heroFocalY?: number;
    heroScale?: number;
    avatarUpdatedAt?: string | null;
    heroUpdatedAt?: string | null;
  }>;
  places?: Array<{ id: number; name: string }>;
  retreatGroups?: Array<{ id: number; name: string; abbreviation?: string | null }>;
  eventType?: { nameEn: string; namePt?: string };
  retreat_group?: {
    id: string;
    name: string;
    name_translations?: Record<string, string>;
    avatarUrl?: string | null;
    heroUrl?: string | null;
    heroFocalX?: number;
    heroFocalY?: number;
    heroScale?: number;
    avatarUpdatedAt?: string | null;
    heroUpdatedAt?: string | null;
  };
  transcripts?: TranscriptInfo[];
  relatedPublications?: Array<{
    id: number;
    title: string;
    coverImageUrl?: string | null;
  }>;
}

const LAST_TRACK_KEY = (eventId: string) => `last_played_track:${eventId}`;

export default function RetreatDetailScreen() {
  const { id, from, trackId: trackIdParam } = useLocalSearchParams<{
    id: string;
    from?: string;
    trackId?: string;
  }>();
  const { t, contentLanguage, language } = useLanguage();
  const { isDesktop, isMobile } = useDesktopLayout();
  const insets = useSafeAreaInsets();
  const audioContext = useAudioPlayerContext();
  const { isAuthenticated } = useAuth();
  const { setMeta: setSidebarMeta } = useRelatedEvents();
  const [retreat, setRetreat] = useState<RetreatDetails | null>(() =>
    retreatService.getRetreatDetailsSync(id)
  );
  // Show spinner only when the lazy initializer found nothing in the mirror.
  const [loading, setLoading] = useState(() =>
    retreatService.getRetreatDetailsSync(id) === null
  );
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  // Keep the hero at a constant height and only fade its opacity. Animating
  // `height` previously caused two coupled artifacts: (1) every frame relayed
  // out the entire scroll tree, leaving a sub-pixel gray strip on the right
  // edge after returning to the top; (2) shrinking height while content also
  // scrolls made everything below appear to move at ~2× finger speed.
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, HERO_COLLAPSE_END * 0.4, HERO_COLLAPSE_END],
      [1, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const handleBack = useCallback(() => {
    if (from === 'events') {
      router.replace('/(tabs)/(groups)/events');
    } else {
      router.back();
    }
  }, [from]);

  // Local UI state for track highlighting and playing bars
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<TrackWithSession | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [allTracks, setAllTracks] = useState<TrackWithSession[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<TrackWithSession[]>([]);
  const [currentLanguageMode, setCurrentLanguageMode] = useState<string>('en');

  // Video playback (separate from the audio context — opens a full-screen modal).
  // Videos are session-scoped: tap "Watch video" on a session to open it here.
  const [videoSession, setVideoSession] = useState<Session | null>(null);
  // App-session-of-use ref to remember "I accepted cellular playback" — survives
  // remounts when the user opens different videos in the same screen visit.
  const cellularAcceptedRef = useRef<boolean>(false);

  // Read Along state (mobile)
  const [readAlongModalVisible, setReadAlongModalVisible] = useState(false);
  const [readAlongData, setReadAlongData] = useState<any>(null);
  const [readAlongLoading, setReadAlongLoading] = useState(false);

  // Overflow menu state
  // Which tab is showing: 'video' (thumbnail grid of session recordings)
  // or 'tracks' (audio session list). We default to 'video' on mount and
  // then sync to whatever the event actually has once it loads.
  const [activeContentTab, setActiveContentTab] = useState<'video' | 'tracks'>('video');
  const [menuVisible, setMenuVisible] = useState(false);

  // Language dropdown state
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  // Download for offline state
  const [isRetreatDownloaded, setIsRetreatDownloaded] = useState(false);
  const [isDownloadingRetreat, setIsDownloadingRetreat] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, startTime: 0 });

  // ZIP download state (for downloading to computer)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipDownloadProgress, setZipDownloadProgress] = useState<string>('');
  const [currentDownloadRequestId, setCurrentDownloadRequestId] = useState<string | null>(null);

  // Pending download confirmation (triggers download in useEffect)
  const [pendingDownloadConfirm, setPendingDownloadConfirm] = useState(false);

  // Event-level bookmark state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  // Track-level bookmark state — set of bookmarked track IDs (as strings).
  // The AudioPlayer reads currentTrack from context; we expose
  // `isCurrentTrackBookmarked` derived from this set.
  const [bookmarkedTrackIds, setBookmarkedTrackIds] = useState<Set<string>>(new Set());
  const [trackBookmarkBusy, setTrackBookmarkBusy] = useState(false);

  // Confirmation modal state
  const [modalState, setModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: ConfirmationButton[];
    icon?: keyof typeof Ionicons.glyphMap;
  }>({ visible: false, title: '', message: '', buttons: [] });

  const showModal = (
    title: string,
    message: string,
    buttons: ConfirmationButton[] = [{ text: 'OK' }],
    icon?: keyof typeof Ionicons.glyphMap
  ) => {
    setModalState({ visible: true, title, message, buttons, icon });
  };

  const hideModal = () => {
    setModalState(prev => ({ ...prev, visible: false }));
  };

  // Build flat list of tracks with session info
  const buildTracksListWithSessions = useCallback(() => {
    if (!retreat?.sessions) {
      return;
    }

    const tracks: TrackWithSession[] = [];

    // Sort sessions by date
    const sortedSessions = [...retreat.sessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const session of sortedSessions) {
      if (session.tracks) {
        const sortedTracks = sortTracksForSession(session.tracks);
        for (const track of sortedTracks) {
          tracks.push({
            ...track,
            sessionId: session.id,
            sessionName: session.name,
            sessionDate: session.date,
            sessionType: session.type,
            sessionPartNumber: session.partNumber,
          });
        }
      }
    }

    setAllTracks(tracks);
  }, [retreat]);

  // Apply language filter to tracks
  const applyLanguageFilter = useCallback(() => {
    setFilteredTracks(filterTracksByLanguage(allTracks, currentLanguageMode as ContentLanguageMode));
  }, [allTracks, currentLanguageMode]);

  useEffect(() => {
    loadRetreatDetails();
  }, [id]);

  useEffect(() => {
    if (retreat) {
      checkDownloadStatus();
      buildTracksListWithSessions();
    }
  }, [retreat, buildTracksListWithSessions]);

  // Apply language filter when language mode or tracks change
  useEffect(() => {
    if (allTracks.length > 0) {
      applyLanguageFilter();
    }
  }, [allTracks, currentLanguageMode, applyLanguageFilter]);

  // Auto-load the last-played track for this event (or fall back to the
  // first one) so the player is ready as soon as the user lands on the
  // page. Runs once per mount; if the global audio context already has a
  // track from this event loaded (e.g. resumed from a previous session),
  // we skip the auto-load — the sync effect below will pick that up and
  // highlight it in the list.
  const autoLoadedRef = useRef(false);

  // Refs for scrolling the track list to the remembered track on open.
  // The Animated.ScrollView's ref + a per-item layout map let us center
  // the active track in view without a FlatList. Only set when there's
  // an actual remembered track to scroll to (not the first-track fallback).
  const scrollViewRef = useRef<any>(null);
  const scrollViewHeightRef = useRef(0);
  const trackLayoutsRef = useRef<Map<string, { y: number; height: number }>>(new Map());
  const pendingScrollTrackIdRef = useRef<string | null>(null);

  const tryScrollToPendingTrack = useCallback(() => {
    const id = pendingScrollTrackIdRef.current;
    if (!id) return;
    const layout = trackLayoutsRef.current.get(id);
    const viewportH = scrollViewHeightRef.current;
    if (!layout || viewportH <= 0) return;
    const target = Math.max(0, layout.y + layout.height / 2 - viewportH / 2);
    scrollViewRef.current?.scrollTo?.({ y: target, animated: false });
    pendingScrollTrackIdRef.current = null;
  }, []);

  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (!retreat || filteredTracks.length === 0) return;

    const ctxTrack = audioContext.currentTrack;
    const ctxTrackInThisEvent = ctxTrack
      ? filteredTracks.some((t) => String(t.id) === String(ctxTrack.id))
      : false;

    if (ctxTrackInThisEvent) {
      // The player already has a track from this event — leave it alone;
      // the sync effect will mirror it into local state for the highlight.
      // Queue a scroll so the list opens centered on it, but skip when
      // it's the first track — there's nothing above to bring into view
      // and scrolling would just hide the hero for no reason.
      const ctxIdx = filteredTracks.findIndex((t) => String(t.id) === String(ctxTrack!.id));
      if (ctxIdx > 0) {
        pendingScrollTrackIdRef.current = String(ctxTrack!.id);
        tryScrollToPendingTrack();
      }
      autoLoadedRef.current = true;
      return;
    }

    autoLoadedRef.current = true;

    (async () => {
      // An explicit trackId param (e.g. tapped from the Bookmarks tab) is
      // an explicit user intent — always load and play it, even if
      // something else is currently playing.
      if (trackIdParam) {
        const idx = filteredTracks.findIndex((t) => String(t.id) === String(trackIdParam));
        if (idx >= 0) {
          selectTrack(filteredTracks[idx], idx);
          if (idx > 0) {
            pendingScrollTrackIdRef.current = String(filteredTracks[idx].id);
            tryScrollToPendingTrack();
          }
          return;
        }
      }

      // Look up this event's per-event last-played track (highlight target).
      let highlightTrack = filteredTracks[0];
      let highlightIndex = 0;
      let resumedFromMemory = false;
      try {
        const lastId = await AsyncStorage.getItem(LAST_TRACK_KEY(retreat.id));
        if (lastId) {
          const idx = filteredTracks.findIndex((t) => String(t.id) === lastId);
          if (idx >= 0) {
            highlightTrack = filteredTracks[idx];
            highlightIndex = idx;
            resumedFromMemory = true;
          }
        }
      } catch {
        // Ignore — fall back to first track.
      }

      if (ctxTrack && !ctxTrackInThisEvent) {
        // Something is already playing from a DIFFERENT event. Don't
        // interrupt the user's current listening session by replacing it.
        // Just update the local highlight state so the user can see which
        // track in this event they last played; tapping it will switch.
        setCurrentTrack(highlightTrack);
        setCurrentTrackIndex(highlightIndex);
        setSelectedTrack(highlightTrack);
        if (resumedFromMemory && highlightIndex > 0) {
          pendingScrollTrackIdRef.current = String(highlightTrack.id);
          tryScrollToPendingTrack();
        }
        return;
      }

      // No track is currently playing — load this event's last-played track
      // (or the first one) as the active player track.
      selectTrack(highlightTrack, highlightIndex);
      if (resumedFromMemory && highlightIndex > 0) {
        pendingScrollTrackIdRef.current = String(highlightTrack.id);
        tryScrollToPendingTrack();
      }
    })();
  }, [retreat, filteredTracks, audioContext.currentTrack, tryScrollToPendingTrack, trackIdParam]);

  // Keep the local highlight in sync with the global audio context. Covers
  // two cases:
  //   1. The auto-load above bailed out because a track from this event was
  //      already in the player — we still need to highlight it in the list.
  //   2. The user advances to the next track via the player's transport
  //      controls — local state must follow.
  useEffect(() => {
    const ctxTrack = audioContext.currentTrack;
    if (!ctxTrack || filteredTracks.length === 0) return;
    const idx = filteredTracks.findIndex((t) => String(t.id) === String(ctxTrack.id));
    if (idx < 0) return;
    const matched = filteredTracks[idx];
    setCurrentTrack((prev) => (prev?.id === matched.id ? prev : matched));
    setCurrentTrackIndex((prev) => (prev === idx ? prev : idx));
    setSelectedTrack((prev) => (prev?.id === matched.id ? prev : matched));
  }, [audioContext.currentTrack, filteredTracks]);

  // Track download completion to prevent stale callbacks
  const downloadCompletedRef = useRef(false);

  // Refresh download status when screen comes into focus
  const hasMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (retreat && hasMountedRef.current) {
        checkDownloadStatus();
        const downloadingRetreatId = downloadService.getDownloadingRetreatId();
        if (downloadingRetreatId !== id && isDownloadingRetreat) {
          setIsDownloadingRetreat(false);
          setDownloadProgress({ current: 0, total: 0, startTime: 0 });
        }
      }
      hasMountedRef.current = true;
    }, [retreat, id, isDownloadingRetreat])
  );

  // Subscribe to download progress if a download is in progress for this retreat
  useEffect(() => {
    const downloadingRetreatId = downloadService.getDownloadingRetreatId();
    if (downloadingRetreatId === id) {
      setIsDownloadingRetreat(true);
      const progress = downloadService.getDownloadProgress();
      if (progress) {
        setDownloadProgress({
          current: progress.current,
          total: progress.total,
          startTime: progress.startTime,
        });
      }

      const unsubscribe = downloadService.subscribeToProgress((progress) => {
        setDownloadProgress({
          current: progress.current,
          total: progress.total,
          startTime: progress.startTime,
        });
      });

      return unsubscribe;
    }
  }, [id]);

  // Handle pending download confirmation
  useEffect(() => {
    if (!pendingDownloadConfirm || !retreat) return;

    setPendingDownloadConfirm(false);
    downloadCompletedRef.current = false;

    const startDownload = async () => {
      const tracks = getAllTracksForDownload();
      const startTime = Date.now();

      setIsDownloadingRetreat(true);
      setDownloadProgress({ current: 0, total: tracks.length, startTime });

      const unsubscribe = downloadService.subscribeToProgress((progress) => {
        if (downloadCompletedRef.current) return;
        setDownloadProgress({
          current: progress.current,
          total: progress.total,
          startTime: progress.startTime,
        });
      });

      try {
        const result = await downloadService.downloadRetreat(
          retreat.id,
          retreat.name,
          tracks,
          (current, total) => {
            if (downloadCompletedRef.current) return;
            setDownloadProgress({ current, total, startTime });
          }
        );

        downloadCompletedRef.current = true;
        unsubscribe();

        setIsDownloadingRetreat(false);
        setDownloadProgress({ current: 0, total: 0, startTime: 0 });

        if (result.success) {
          setIsRetreatDownloaded(true);
        } else if (result.cancelled) {
          console.log('Download cancelled');
        } else {
          showModal(
            'Download Failed',
            result.error || 'Failed to download retreat',
            [{ text: 'OK' }],
            'alert-circle-outline'
          );
        }
      } catch (error) {
        downloadCompletedRef.current = true;
        unsubscribe();
        setIsDownloadingRetreat(false);
        setDownloadProgress({ current: 0, total: 0, startTime: 0 });
        console.error('Download error:', error);
        showModal(
          'Download Failed',
          'An unexpected error occurred',
          [{ text: 'OK' }],
          'alert-circle-outline'
        );
      }
    };

    startDownload();
  }, [pendingDownloadConfirm, retreat]);

  const loadRetreatDetails = async () => {
    try {
      // Only show the full-screen spinner when lazy initializer found no
      // cached data in the mirror. This is a background refresh otherwise.
      if (retreat === null) setLoading(true);
      setError(null);

      // Load language preference
      let initialLanguageMode = 'en';
      try {
        const retreatLanguageKey = `retreat_language_${id}`;
        const storedLanguage = await AsyncStorage.getItem(retreatLanguageKey);
        if (storedLanguage && ['en', 'en-pt', 'pt'].includes(storedLanguage)) {
          initialLanguageMode = storedLanguage;
        } else {
          initialLanguageMode = contentLanguage || 'en';
        }
      } catch (storageError) {
        initialLanguageMode = contentLanguage || 'en';
      }
      setCurrentLanguageMode(initialLanguageMode);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await retreatService.getRetreatDetails(id, { force: true });
    await loadRetreatDetails();
    setRefreshing(false);
  };

  // Default content tab when the event loads: 'video' if any session has
  // a recording, otherwise 'tracks'. This runs whenever a different
  // event is loaded (which remounts the screen).
  useEffect(() => {
    if (!retreat) return;
    const anyVideo = retreat.sessions?.some((s) => !!s.bunnyVideoId);
    setActiveContentTab(anyVideo ? 'video' : 'tracks');
  }, [retreat]);

  // Load whether this event is currently bookmarked. We check by listing
  // the user's bookmarks (typically a small set) rather than adding a
  // dedicated endpoint. Skip entirely when unauthenticated — public-event
  // viewers can't bookmark and we shouldn't waste a 401.
  useEffect(() => {
    if (!isAuthenticated) {
      setIsBookmarked(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await eventBookmarkService.list();
      if (cancelled || !res.success || !res.data) return;
      setIsBookmarked(res.data.some((bm) => String(bm.eventId) === String(id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated]);

  const toggleBookmark = useCallback(async () => {
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked); // optimistic
    try {
      const res = wasBookmarked
        ? await eventBookmarkService.remove(id)
        : await eventBookmarkService.add(id);
      if (!res.success) {
        setIsBookmarked(wasBookmarked); // revert
      }
    } finally {
      setBookmarkBusy(false);
    }
  }, [bookmarkBusy, id, isBookmarked]);

  // Load the user's track bookmarks so we can paint the toolbar icon
  // correctly for whichever track plays. One fetch per event-screen mount.
  // Skipped when unauthenticated (no API call, no toolbar toggle).
  useEffect(() => {
    if (!isAuthenticated) {
      setBookmarkedTrackIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await trackBookmarkService.list();
      if (cancelled || !res.success || !res.data) return;
      setBookmarkedTrackIds(new Set(res.data.map((bm) => String(bm.trackId))));
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated]);

  const isCurrentTrackBookmarked = currentTrack
    ? bookmarkedTrackIds.has(String(currentTrack.id))
    : false;

  const toggleCurrentTrackBookmark = useCallback(async () => {
    if (trackBookmarkBusy || !currentTrack) return;
    const trackId = String(currentTrack.id);
    setTrackBookmarkBusy(true);
    const wasBookmarked = bookmarkedTrackIds.has(trackId);
    // Optimistic update.
    setBookmarkedTrackIds((prev) => {
      const next = new Set(prev);
      if (wasBookmarked) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
    try {
      const res = wasBookmarked
        ? await trackBookmarkService.remove(trackId)
        : await trackBookmarkService.add(trackId);
      if (!res.success) {
        // Revert on failure.
        setBookmarkedTrackIds((prev) => {
          const next = new Set(prev);
          if (wasBookmarked) next.add(trackId);
          else next.delete(trackId);
          return next;
        });
      }
    } finally {
      setTrackBookmarkBusy(false);
    }
  }, [bookmarkedTrackIds, currentTrack, trackBookmarkBusy]);

  // Push event metadata into the layout-level sidebar context. The
  // sidebar lives in (groups)/_layout.tsx, so updating meta here only
  // changes which item is highlighted — the sidebar itself does not
  // remount as we navigate from one event to another.
  //
  // The sidebar context follows the navigation entry point:
  //   - `from=events` (Teachings & Talks, Home featured/recent, teacher
  //     page) → show the teacher's events.
  //   - otherwise (Retreats → Group → Event) → show the group's events.
  // Setting only one of teacherAbbreviation/groupId at a time disables
  // RelatedEventsList's teacher-first preference so each path lands on
  // its own list.
  useEffect(() => {
    if (!retreat) return;
    const teacher = retreat.teachers?.[0];
    const group = retreat.retreat_group;
    const showTeacherView = from === 'events' && !!teacher;
    setSidebarMeta({
      eventId: String(retreat.id),
      teacherAbbreviation: showTeacherView ? (teacher?.abbreviation ?? null) : null,
      groupId: showTeacherView ? null : (group?.id ? String(group.id) : null),
      headerTitle: showTeacherView
        ? (teacher?.name || '')
        : (group ? getTranslatedName(group, language) : ''),
      headerSubtitle: showTeacherView
        ? (t('events.teachings') || 'Teachings & Talks')
        : (group ? (t('events.retreats') || 'Retreats') : undefined),
    });
    // We deliberately do NOT clear meta on unmount — leaving the last
    // value in place avoids a frame where the sidebar disappears while
    // the next event screen is still mounting.
  }, [retreat, language, setSidebarMeta, t, from]);

  const checkDownloadStatus = async () => {
    if (!retreat) return;
    const downloaded = await downloadService.isRetreatDownloaded(retreat.id);
    setIsRetreatDownloaded(downloaded);
  };

  // Language toggle
  const updateLanguagePreference = async (newLanguageMode: string) => {
    if (!retreat) return;
    try {
      const retreatLanguageKey = `retreat_language_${id}`;
      await AsyncStorage.setItem(retreatLanguageKey, newLanguageMode);
      setCurrentLanguageMode(newLanguageMode);
    } catch (error) {
      console.error('Failed to save language preference:', error);
      setCurrentLanguageMode(newLanguageMode);
    }
  };

  const getLanguageLabel = (languageMode?: string) => {
    switch (languageMode) {
      case 'en': return t('profile.englishOnly') || 'English Only';
      case 'en-pt': return t('profile.englishPortuguese') || 'English + Portuguese';
      case 'pt': return t('profile.portugueseOnly') || 'Portuguese Only';
      default: return t('profile.englishOnly') || 'English Only';
    }
  };

  // Track selection — tracks are always audio. Videos are session-scoped and
  // opened via the "Watch video" button in the session header below.
  const selectTrack = (track: TrackWithSession, trackIndex: number) => {
    setShowLanguageDropdown(false);
    setCurrentTrack(track);
    setCurrentTrackIndex(trackIndex);
    setSelectedTrack(track);

    audioContext.playTrack(track, filteredTracks, trackIndex, {
      retreatId: retreat!.id,
      retreatName: getTranslatedName(retreat!, language) || retreat!.name,
      groupName: retreat!.retreat_group ? (getTranslatedName(retreat!.retreat_group, language) || retreat!.retreat_group.name) : '',
    });

    // Persist the last-played track for this event so the next visit can
    // resume the player at the right place.
    AsyncStorage.setItem(LAST_TRACK_KEY(retreat!.id), String(track.id)).catch(() => {});
  };

  /** Open the video modal for the given session. */
  const watchSessionVideo = useCallback((session: Session) => {
    setVideoSession(session);
  }, []);

  const goToNextTrack = () => {
    const nextIndex = currentTrackIndex + 1;
    if (nextIndex < filteredTracks.length) {
      selectTrack(filteredTracks[nextIndex], nextIndex);
    }
  };

  const goToPreviousTrack = () => {
    const prevIndex = currentTrackIndex - 1;
    if (prevIndex >= 0) {
      selectTrack(filteredTracks[prevIndex], prevIndex);
    }
  };

  const handleTrackComplete = () => {
    if (currentTrackIndex < filteredTracks.length - 1) {
      goToNextTrack();
    } else {
      Alert.alert(
        t('session.sessionComplete') || 'Retreat Complete',
        t('session.sessionCompleteMessage') || 'You have finished all tracks in this retreat!'
      );
    }
  };

  const handleProgressUpdate = (progress: UserProgress) => {
    console.log('Progress updated:', progress);
  };

  // Register audio context callbacks
  useEffect(() => {
    audioContext.setOnTrackComplete(handleTrackComplete);
    audioContext.setOnProgressUpdate(handleProgressUpdate);
    audioContext.setOnPlayingStateChange(setIsTrackPlaying);

    return () => {
      audioContext.setOnTrackComplete(undefined);
      audioContext.setOnProgressUpdate(undefined);
      audioContext.setOnPlayingStateChange(undefined);
    };
  }, [currentTrackIndex, filteredTracks]);

  // Register next/previous track callbacks
  useEffect(() => {
    audioContext.setOnNextTrack(currentTrackIndex < filteredTracks.length - 1 ? goToNextTrack : undefined);
    audioContext.setOnPreviousTrack(currentTrackIndex > 0 ? goToPreviousTrack : undefined);
    return () => {
      audioContext.setOnNextTrack(undefined);
      audioContext.setOnPreviousTrack(undefined);
    };
  }, [currentTrackIndex, filteredTracks]);

  // Register read-along + transcript open handlers so the desktop player
  // bar can show transcript / read-along buttons in its right zone.
  useEffect(() => {
    audioContext.setOnOpenReadAlong(currentTrack?.hasReadAlong ? handleOpenReadAlong : undefined);
    return () => {
      audioContext.setOnOpenReadAlong(undefined);
    };
  }, [currentTrack?.hasReadAlong]);

  useEffect(() => {
    const hasAnyTranscript = !!retreat?.transcripts && retreat.transcripts.length > 0;
    audioContext.setOnOpenTranscript(
      hasAnyTranscript && retreat
        ? () => router.push(`/(tabs)/(groups)/transcript/${retreat.id}` as any)
        : undefined,
    );
    return () => {
      audioContext.setOnOpenTranscript(undefined);
    };
  }, [retreat?.id, retreat?.transcripts?.length]);

  // Update upcoming tracks for pre-caching when track or list changes
  useEffect(() => {
    if (currentTrack && filteredTracks.length > 0) {
      audioContext.setUpcomingTracks(filteredTracks.slice(currentTrackIndex + 1));
    }
  }, [currentTrackIndex, filteredTracks, currentTrack]);

  const formatDuration = (seconds: number): string | null => {
    if (!seconds || seconds <= 0) return null;
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return '<1m';
    return `${minutes}m`;
  };

  // Format session date header - "Day 1 · April 18th · Morning · Part 1"
  const formatSessionHeader = (session: { sessionName: string; sessionDate: string; sessionType: string; sessionPartNumber?: number | null }) => {
    const sessionType = t(`retreats.${session.sessionType}`) || session.sessionType;
    const partLabel = t('retreats.part') || 'Part';
    const partSuffix = session.sessionPartNumber ? ` · ${partLabel} ${session.sessionPartNumber}` : '';

    const sessionDate = new Date(session.sessionDate);
    if (isNaN(sessionDate.getTime())) {
      // Session has no valid date — degrade gracefully instead of "Day NaN · Invalid Date NaNth"
      return sessionType ? `${sessionType}${partSuffix}` : (session.sessionName || '');
    }

    const month = sessionDate.toLocaleDateString('en-US', { month: 'long' });
    const dayNum = sessionDate.getDate();
    const getOrdinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const dateLabel = `${month} ${getOrdinal(dayNum)}`;

    const retreatStartDate = retreat ? new Date(retreat.startDate) : sessionDate;
    if (isNaN(retreatStartDate.getTime())) {
      return `${dateLabel} · ${sessionType}${partSuffix}`;
    }

    const diffTime = sessionDate.getTime() - retreatStartDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const dayNumber = diffDays + 1;
    return `Day ${dayNumber} · ${dateLabel} · ${sessionType}${partSuffix}`;
  };

  const calculateTotalRetreatSize = () => {
    if (!retreat) return 0;
    return retreat.sessions.reduce((total, session) => {
      return total + (session.tracks?.reduce((sessionTotal, track) => {
        return sessionTotal + (track.file_size || estimateAudioFileSize(track.duration));
      }, 0) || 0);
    }, 0);
  };

  const getAllTracksForDownload = (): Array<{ id: string; title: string }> => {
    if (!retreat) return [];
    const tracks: Array<{ id: string; title: string }> = [];
    retreat.sessions.forEach(session => {
      if (session.tracks) {
        session.tracks.forEach(track => {
          tracks.push({ id: track.id, title: track.title });
        });
      }
    });
    return tracks;
  };

  // Handle download for offline
  const handleDownloadForOffline = async () => {
    if (!retreat) return;
    setMenuVisible(false);

    if (isRetreatDownloaded) {
      showModal(
        'Remove Download',
        `Remove "${getTranslatedName(retreat, language)}" from offline storage?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              const result = await downloadService.removeDownloadedRetreat(retreat.id);
              if (result.success) {
                setIsRetreatDownloaded(false);
              }
            },
          },
        ],
        'cloud-offline-outline'
      );
      return;
    }

    const tracks = getAllTracksForDownload();
    const totalSize = formatBytes(calculateTotalRetreatSize());

    showModal(
      'Download for offline listening',
      `Download all ${tracks.length} tracks (${totalSize}) for offline listening?\n\nThis content won't be automatically removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => {
            setPendingDownloadConfirm(true);
          },
        },
      ],
      'download-outline'
    );
  };

  // Handle ZIP download
  const handleDownloadRetreatZip = async () => {
    if (!retreat) return;
    setMenuVisible(false);

    if (isDownloadingZip) {
      setIsDownloadingZip(false);
      setZipDownloadProgress('');
      await downloadStateService.removeDownloadState(retreat.id);
      return;
    }

    setIsDownloadingZip(true);
    setZipDownloadProgress('Preparing download...');

    try {
      // Try authenticated endpoint first, fall back to public for unauthenticated users
      let requestResponse = await apiService.post(API_ENDPOINTS.EVENT_DOWNLOAD_REQUEST(retreat.id));

      if (!requestResponse.success) {
        requestResponse = await apiService.post(API_ENDPOINTS.PUBLIC_EVENT_DOWNLOAD_REQUEST(retreat.id));
      }

      if (!requestResponse.success) {
        throw new Error(requestResponse.error || 'Failed to prepare download');
      }

      const requestId = (requestResponse.data as any)?.request_id;
      if (!requestId) {
        throw new Error('No request ID received');
      }

      setCurrentDownloadRequestId(requestId);

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

      let isComplete = false;
      let attempt = 0;
      const maxAttempts = 240;

      while (!isComplete && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statusResponse = await apiService.get(API_ENDPOINTS.DOWNLOAD_STATUS(requestId));

        if (!statusResponse.success) {
          throw new Error(statusResponse.error || 'Failed to check ZIP status');
        }

        if ((statusResponse.data as any)?.status === 'ready') {
          isComplete = true;
          setZipDownloadProgress('ZIP ready! Starting download...');
        } else if ((statusResponse.data as any)?.status === 'failed') {
          throw new Error((statusResponse.data as any)?.error_message || 'ZIP generation failed');
        } else if ((statusResponse.data as any)?.status === 'processing') {
          const progressPercent = (statusResponse.data as any)?.progress_percent;
          const progressMsg = progressPercent !== undefined
            ? `Generating ZIP... ${progressPercent}%`
            : 'Generating ZIP file...';
          setZipDownloadProgress(progressMsg);
        }

        attempt++;
      }

      if (!isComplete) {
        throw new Error('Download preparation timed out');
      }

      const downloadResponse = await apiService.get(API_ENDPOINTS.DOWNLOAD_FILE(requestId));

      if (!(downloadResponse.data as any)?.success || !(downloadResponse.data as any)?.download_url) {
        throw new Error('Failed to get download URL');
      }

      const { Linking } = require('react-native');
      await Linking.openURL((downloadResponse.data as any).download_url);

      await downloadStateService.removeDownloadState(retreat.id);

    } catch (error: any) {
      console.error('ZIP download error:', error);
      await downloadStateService.removeDownloadState(retreat?.id || '');
      showModal(
        'Download Error',
        error.message || 'Failed to download ZIP',
        [{ text: 'OK' }],
        'alert-circle-outline'
      );
    } finally {
      setIsDownloadingZip(false);
      setZipDownloadProgress('');
      setCurrentDownloadRequestId(null);
    }
  };

  // Handle Read Along (mobile)
  const handleOpenReadAlong = useCallback(async () => {
    if (!currentTrack) return;
    setReadAlongLoading(true);
    setReadAlongModalVisible(true);
    try {
      const result = await retreatService.getReadAlongData(String(currentTrack.id));
      if (result.success && result.data) {
        setReadAlongData(result.data);
      }
    } catch (err) {
      console.error('Failed to load Read Along:', err);
    } finally {
      setReadAlongLoading(false);
    }
  }, [currentTrack]);

  const handleCloseReadAlong = useCallback(() => {
    setReadAlongModalVisible(false);
    setReadAlongData(null);
  }, []);

  // When the user advances to another track (e.g. via the player's next/prev
  // controls), keep the read-along modal open and load the new track's
  // alignment data — or close the modal if the new track has no read-along.
  useEffect(() => {
    if (!readAlongModalVisible || !currentTrack) return;
    if (!currentTrack.hasReadAlong) {
      setReadAlongModalVisible(false);
      setReadAlongData(null);
      return;
    }
    let cancelled = false;
    setReadAlongLoading(true);
    setReadAlongData(null);
    (async () => {
      try {
        const result = await retreatService.getReadAlongData(String(currentTrack.id));
        if (cancelled) return;
        if (result.success && result.data) {
          setReadAlongData(result.data);
        }
      } catch (err) {
        console.error('Failed to load Read Along on track change:', err);
      } finally {
        if (!cancelled) setReadAlongLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.hasReadAlong, readAlongModalVisible]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>{t('common.loading') || 'Loading...'}</Text>
        </View>
      </View>
    );
  }

  if (error || !retreat) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('retreats.notFound') || 'Retreat not found'}</Text>
          <TouchableOpacity onPress={handleBack} style={styles.backButtonError}>
            <Text style={styles.backButtonText}>{t('common.goBack') || 'Go Back'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render the track list (shared between desktop master panel and mobile)
  const renderTrackList = (paddingBottom: number) => {
    let trackSessionId: string | null = null;
    let isFirstSession = true;

    // Lookup map for session-level data (notably bunnyVideoId so we can show
    // a "Watch video" button on sessions with an attached recording).
    const sessionsById = new Map<string, Session>();
    retreat?.sessions?.forEach((s) => sessionsById.set(s.id, s));

    // Mobile-only: collapsing hero. Use the parent group's photo when set;
    // otherwise fall back to the principal teacher's hero so public talks
    // (which are not attached to any retreat group) still get a portrait.
    // selectHero picks the 1200px mobile WebP variant on phone-sized
    // viewports and the 2400px desktop WebP everywhere else; the variant
    // tag also feeds into the cache key so expo-image keeps the two
    // resolutions in distinct cache buckets.
    const groupHeroPick = selectHero(retreat?.retreat_group, isMobile);
    const teacherHeroPick = selectHero(retreat?.teachers?.[0], isMobile);
    // Show the hero on both mobile and desktop now — desktop renders the
    // event content (hero + title + tracks) in the right pane just like
    // mobile, so the hero applies there too.
    const useGroupHero = !!groupHeroPick.url;
    const heroSource = groupHeroPick.url ?? teacherHeroPick.url;
    const heroFocalX = useGroupHero
      ? (retreat?.retreat_group?.heroFocalX ?? 50)
      : (retreat?.teachers?.[0]?.heroFocalX ?? 50);
    const heroFocalY = useGroupHero
      ? (retreat?.retreat_group?.heroFocalY ?? 50)
      : (retreat?.teachers?.[0]?.heroFocalY ?? 50);
    const heroScale = useGroupHero
      ? (retreat?.retreat_group?.heroScale ?? 100)
      : (retreat?.teachers?.[0]?.heroScale ?? 100);
    const heroCacheKey = useGroupHero && retreat?.retreat_group
      ? groupHeroCacheKey(retreat.retreat_group as any, groupHeroPick.variant)
      : retreat?.teachers?.[0]
        ? teacherHeroCacheKey(retreat.teachers[0], teacherHeroPick.variant)
        : undefined;

    // Computed bits for the title block under the hero.
    const titleText = retreat ? getTranslatedName(retreat as any, language) : '';
    const speakersText = retreat?.teachers?.map((te) => te.name).filter(Boolean).join(', ') || '';
    const eventTypeLabel = retreat?.eventType
      ? (language === 'pt' && retreat.eventType.namePt ? retreat.eventType.namePt : retreat.eventType.nameEn)
      : null;
    const dateLabel = retreat?.startDate ? formatLongDate(retreat.startDate, language) : '';
    const metaParts = [
      t('events.recordingsLabel') || 'Recordings',
      eventTypeLabel,
      dateLabel,
    ].filter(Boolean);

    // Indicators for the floating circles on the hero.
    const hasAudio = !!retreat?.sessions?.some((s) => (s.tracks?.length ?? 0) > 0);
    const hasVideo = !!retreat?.sessions?.some((s) => !!s.bunnyVideoId);
    const hasTranscript = !!retreat?.transcripts && retreat.transcripts.length > 0;
    const firstVideoSession = retreat?.sessions?.find((s) => !!s.bunnyVideoId) ?? null;

    // Sessions that have a recording — used by the Video tab grid.
    const videoSessions = (retreat?.sessions ?? []).filter((s) => !!s.bunnyVideoId);
    // Tabs only appear when both content types are available; otherwise
    // the screen renders whichever exists.
    const showContentTabs = hasVideo && hasAudio;
    const effectiveTab: 'video' | 'tracks' = showContentTabs
      ? activeContentTab
      : (hasVideo ? 'video' : 'tracks');

    // Helper for the video card title — reuses the same session header
    // formatting as the audio track list so the two stay consistent.
    const renderSessionTitle = (s: Session) => formatSessionHeader({
      sessionName: s.name,
      sessionDate: s.date,
      sessionType: s.type,
      sessionPartNumber: s.partNumber ?? null,
    });
    const formatDurationForGrid = (seconds: number) => formatDuration(seconds) || '';

    return (
      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom }]}
        onScroll={isDesktop ? undefined : scrollHandler}
        scrollEventThrottle={16}
        onLayout={(e) => {
          scrollViewHeightRef.current = e.nativeEvent.layout.height;
          tryScrollToPendingTrack();
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.burgundy[500]}
          />
        }
      >
        {/* Hero (mobile only) — collapses on scroll. Floating action circles
            sit at the bottom-right and overlap the boundary between hero and
            content, exactly like the design. */}
        {heroSource && (
          <Animated.View style={[styles.heroContainer, heroStyle]}>
            <View style={styles.heroImageWrapper}>
              <ExpoImage
                source={{ uri: heroSource }}
                cacheKey={heroCacheKey}
                cachePolicy="memory-disk"
                transition={0}
                style={[
                  StyleSheet.absoluteFillObject,
                  heroScale !== 100 && { transform: [{ scale: heroScale / 100 }] },
                ]}
                contentFit="cover"
                contentPosition={{ left: `${heroFocalX}%`, top: `${heroFocalY}%` }}
              />
            </View>
            {/* Informative-only badges showing what content the event has.
                Transcript is opened from the desktop player bar; audio/video
                are accessed from the tabs and track list below. */}
            <View style={styles.heroActionRow} pointerEvents="none">
              {hasVideo && (
                <View style={styles.heroActionCircle}>
                  <Ionicons name="videocam-outline" size={18} color={colors.white} />
                </View>
              )}
              {hasAudio && (
                <View style={styles.heroActionCircle}>
                  <Ionicons name="musical-notes-outline" size={18} color={colors.white} />
                </View>
              )}
              {hasTranscript && (
                <View style={styles.heroActionCircle}>
                  <Ionicons name="book-outline" size={18} color={colors.white} />
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Event title block — sits below the hero on both mobile and
            desktop. On mobile it replaces the title that used to live in
            the fixed top bar; on desktop it's the main event header. */}
        {(
          <View style={styles.eventTitleSection}>
            <Text style={styles.eventTitleText}>{titleText}</Text>
            {speakersText ? (
              <Text style={styles.eventSpeakerText}>{speakersText}</Text>
            ) : null}
            {metaParts.length > 0 && (
              <Text style={styles.eventTitleMetaText}>{metaParts.join(' | ')}</Text>
            )}
          </View>
        )}

        {/* Tab bar — only shown when the event has both audio tracks and
            video recordings. Sits between the title and the content. */}
        {showContentTabs && (
          <View style={styles.contentTabBar}>
            <Pressable
              style={[styles.contentTab, effectiveTab === 'video' && styles.contentTabActive]}
              onPress={() => setActiveContentTab('video')}
              accessibilityRole="tab"
              accessibilityState={{ selected: effectiveTab === 'video' }}
            >
              <Text style={[styles.contentTabText, effectiveTab === 'video' && styles.contentTabTextActive]}>
                {t('eventTabs.videos') || 'Videos'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.contentTab, effectiveTab === 'tracks' && styles.contentTabActive]}
              onPress={() => setActiveContentTab('tracks')}
              accessibilityRole="tab"
              accessibilityState={{ selected: effectiveTab === 'tracks' }}
            >
              <Text style={[styles.contentTabText, effectiveTab === 'tracks' && styles.contentTabTextActive]}>
                {t('eventTabs.tracks') || 'Audio'}
              </Text>
            </Pressable>
          </View>
        )}

        {effectiveTab === 'video' && hasVideo && (
          <VideoGrid
            sessions={videoSessions as any}
            onPlay={(s) => watchSessionVideo(s as any)}
            renderTitle={(s) => renderSessionTitle(s as any)}
            formatDuration={formatDurationForGrid}
          />
        )}

        {effectiveTab === 'tracks' && filteredTracks.map((track, trackIndex) => {
          const isActive = currentTrack?.id === track.id;
          const isSelected = selectedTrack?.id === track.id;
          const showSessionHeader = track.sessionId !== trackSessionId;
          let wasFirstSession = false;
          if (showSessionHeader) {
            wasFirstSession = isFirstSession;
            isFirstSession = false;
          }
          trackSessionId = track.sessionId;

          const prevTrack = trackIndex > 0 ? filteredTracks[trackIndex - 1] : null;
          const nextTrack = trackIndex < filteredTracks.length - 1 ? filteredTracks[trackIndex + 1] : null;
          const isContinuation = !showSessionHeader
            && !!prevTrack
            && prevTrack.sessionId === track.sessionId
            && prevTrack.order === track.order;
          const nextIsContinuation = !!nextTrack
            && nextTrack.sessionId === track.sessionId
            && nextTrack.order === track.order;

          return (
            <React.Fragment key={track.id}>
              {/* Session Header. The "Watch video" link used to live here
                  but the dedicated Video tab now provides that
                  affordance, so the header is text-only. */}
              {showSessionHeader && (
                <View style={[styles.sessionHeader, !wasFirstSession && styles.sessionHeaderSubsequent]}>
                  <Text style={styles.sessionHeaderText}>
                    {formatSessionHeader(track)}
                  </Text>
                </View>
              )}

              {/* Track Item */}
              <TouchableOpacity
                onPress={() => selectTrack(track, trackIndex)}
                onLayout={(e) => {
                  const { y, height } = e.nativeEvent.layout;
                  trackLayoutsRef.current.set(String(track.id), { y, height });
                  if (pendingScrollTrackIdRef.current === String(track.id)) {
                    tryScrollToPendingTrack();
                  }
                }}
                style={[
                  styles.trackItem,
                  isActive && styles.currentTrackItem,
                  isDesktop && isSelected && !isActive && styles.selectedTrackItem,
                  nextIsContinuation && styles.trackItemSiblingAbove,
                ]}
              >
                <View style={styles.trackNumberContainer}>
                  {!isContinuation && (
                    <Text style={[
                      styles.trackNumber,
                      isActive && styles.currentTrackNumber
                    ]}>
                      {track.order}
                    </Text>
                  )}
                </View>

                <View style={styles.trackInfo}>
                  <Text style={[
                    styles.trackTitle,
                    isActive && styles.currentTrackTitle
                  ]}>
                    {track.title}
                  </Text>
                  <View style={styles.trackSubtitleRow}>
                    {track.languages && track.languages.length > 0 && track.languages.map((lang: string) => (
                      <View key={lang} style={[styles.langBadge, langBadgeColor(lang)]}>
                        <Text style={[styles.langBadgeText, langBadgeTextColor(lang)]}>
                          {lang.toUpperCase()}
                        </Text>
                      </View>
                    ))}
                    <Text style={styles.trackDuration}>
                      {[track.speakerName, formatDuration(track.duration)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>

                <View style={styles.trackRightSection}>
                  {isActive && (
                    <View style={styles.playingIndicator}>
                      <AnimatedPlayingBars
                        isPlaying={isTrackPlaying}
                        size={20}
                        color={colors.burgundy[500]}
                      />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}

        {/* Transcript-only fallback: when the event has no audio tracks and no
            video recording but a transcript exists, surface it here so the
            content area is never empty for these events. */}
        {!hasAudio && !hasVideo && hasTranscript && retreat && (
          <View style={styles.transcriptOnlySection}>
            <Ionicons
              name="book-outline"
              size={40}
              color={colors.gray[400]}
              style={styles.transcriptOnlyIcon}
            />
            <Text style={styles.transcriptOnlyMessage}>
              {t('events.transcriptOnlyMessage')
                || 'No audio or video recordings are available for this event. Only the written transcript is available.'}
            </Text>
            <TouchableOpacity
              style={styles.transcriptOnlyButton}
              onPress={() => router.push(`/(tabs)/(groups)/transcript/${retreat.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={t('transcript.open') || 'Open transcript'}
            >
              <Ionicons name="book" size={18} color={colors.white} />
              <Text style={styles.transcriptOnlyButtonText}>
                {t('transcript.open') || 'Open transcript'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {retreat?.relatedPublications && retreat.relatedPublications.length > 0 && (
          <View style={styles.relatedPublicationsSection}>
            <Text style={styles.relatedPublicationsTitle}>
              {t('publications.relatedTitle') || 'Related Publications'}
            </Text>
            {retreat.relatedPublications.map((pub) => (
              <TouchableOpacity
                key={pub.id}
                style={styles.relatedPublicationItem}
                onPress={() => router.push('/(tabs)/(groups)/publications' as any)}
              >
                {pub.coverImageUrl ? (
                  <Image source={{ uri: pub.coverImageUrl }} style={styles.relatedPubCover} />
                ) : (
                  <View style={[styles.relatedPubCover, styles.relatedPubCoverPlaceholder]}>
                    <Ionicons name="book-outline" size={16} color={colors.gray[400]} />
                  </View>
                )}
                <Text style={styles.relatedPubTitle} numberOfLines={1}>
                  {pub.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.ScrollView>
    );
  };

  // Common download progress banners (used by both mobile floating overlay
  // and desktop fixed header)
  const renderDownloadBanners = () => (
    <>
      {isDownloadingRetreat && (
        <View style={styles.downloadBanner}>
          <View style={styles.downloadBannerContent}>
            <View style={styles.downloadBannerHeader}>
              <Text style={styles.downloadBannerTitle}>Downloading for offline listening...</Text>
              <TouchableOpacity onPress={() => downloadService.cancelDownload()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={colors.gray[500]} />
              </TouchableOpacity>
            </View>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%` }
                ]}
              />
            </View>
            <Text style={styles.downloadBannerSubtext}>
              {downloadProgress.current} of {downloadProgress.total} tracks
              {downloadProgress.startTime > 0 && downloadProgress.current > 0 && (() => {
                const elapsed = (Date.now() - downloadProgress.startTime) / 1000;
                const perTrack = elapsed / downloadProgress.current;
                const remaining = (downloadProgress.total - downloadProgress.current) * perTrack;
                if (remaining < 60) return ` • ~${Math.ceil(remaining)}s remaining`;
                return ` • ~${Math.ceil(remaining / 60)}m remaining`;
              })()}
            </Text>
          </View>
        </View>
      )}
      {isDownloadingZip && (
        <View style={styles.downloadBanner}>
          <ActivityIndicator size="small" color={colors.burgundy[500]} />
          <Text style={styles.downloadBannerText}>{zipDownloadProgress}</Text>
          <TouchableOpacity onPress={handleDownloadRetreatZip}>
            <Ionicons name="close" size={20} color={colors.gray[600]} />
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      {/* No fixed top bar on either platform — the hero extends to the very
          top of the content area. Controls (language pill + overflow menu)
          float over the hero. Mobile additionally shows a back button. */}
      {!isDesktop && (
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.floatingTopButton, styles.floatingTopButtonLeft, { top: insets.top + 8 }]}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
      )}

      <View
        style={[
          styles.floatingTopRightCluster,
          { top: isDesktop ? 16 : insets.top + 8 },
        ]}
      >
        {isDesktop && currentLanguageMode && (
          <View style={styles.languageDropdownContainerFloating}>
            <TouchableOpacity
              style={styles.languageButtonFloating}
              onPress={() => setShowLanguageDropdown(!showLanguageDropdown)}
              hitSlop={8}
            >
              <Text style={styles.languageButtonFloatingText}>
                {getLanguageLabel(currentLanguageMode)}
              </Text>
              <Ionicons
                name={showLanguageDropdown ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.white}
              />
            </TouchableOpacity>
            {showLanguageDropdown && (
              <View style={styles.languageDropdown}>
                {(['en', 'en-pt', 'pt'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.languageDropdownItem,
                      currentLanguageMode === mode && styles.languageDropdownItemActive,
                    ]}
                    onPress={() => {
                      updateLanguagePreference(mode);
                      setShowLanguageDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.languageDropdownItemText,
                        currentLanguageMode === mode && styles.languageDropdownItemTextActive,
                      ]}
                    >
                      {getLanguageLabel(mode)}
                    </Text>
                    {currentLanguageMode === mode && (
                      <Ionicons name="checkmark" size={16} color={colors.burgundy[500]} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
        {isAuthenticated && (
          <TouchableOpacity
            onPress={toggleBookmark}
            disabled={bookmarkBusy}
            style={styles.floatingTopButtonInline}
            hitSlop={8}
            accessibilityLabel={
              isBookmarked
                ? t('bookmarks.remove') || 'Remove bookmark'
                : t('bookmarks.add') || 'Bookmark this event'
            }
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={colors.white}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={styles.floatingTopButtonInline}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-vertical" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {(isDownloadingRetreat || isDownloadingZip) && (
        <View
          style={[
            styles.mobileDownloadBannerOverlay,
            { top: (isDesktop ? 16 : insets.top + 8) + 48 },
          ]}
        >
          {renderDownloadBanners()}
        </View>
      )}

      {/* Main content. The desktop "related events" sidebar is mounted by
          (groups)/_layout.tsx so it survives event-to-event navigation —
          the screen itself just renders the event content (hero + title +
          tracks) on both platforms. */}
      {isDesktop ? (
        renderTrackList(24)
      ) : (
        <>
          {/* Bottom padding clears the floating audio player AND the tab bar
              when the in-event player is visible. When it is hidden (a track
              from a different event is playing), the mini-player above the
              tab bar takes its place — reserve space for that instead. */}
          {(() => {
            const ownsCurrentTrack =
              audioContext.retreatId != null &&
              String(audioContext.retreatId) === String(retreat.id);
            return (
              <>
                {renderTrackList(
                  ownsCurrentTrack
                    ? 145 + 49 + insets.bottom + 16
                    : 60 + 49 + insets.bottom + 16
                )}
                {ownsCurrentTrack && (
                  <AudioPlayer
                    languageLabel={currentLanguageMode ? getLanguageLabel(currentLanguageMode) : undefined}
                    onLanguagePress={() => setShowLanguageDropdown(true)}
                    onReadPress={currentTrack?.hasReadAlong ? handleOpenReadAlong : undefined}
                    onBookmarkPress={currentTrack && isAuthenticated ? toggleCurrentTrackBookmark : undefined}
                    isBookmarked={isCurrentTrackBookmarked}
                  />
                )}
              </>
            );
          })()}
        </>
      )}

      {/* Full-screen video player (opens when a session's "Watch video" is tapped) */}
      <VideoPlayer
        session={videoSession}
        cellularAcceptedRef={cellularAcceptedRef}
        onClose={() => setVideoSession(null)}
        onComplete={() => {
          // Video reached the end. Close the modal — there's no notion of
          // "next video" because each session has at most one.
          setVideoSession(null);
        }}
      />

      {/* Overflow Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            {/* Download for offline listening Option */}
            <TouchableOpacity style={styles.menuItem} onPress={handleDownloadForOffline}>
              <Ionicons
                name={isRetreatDownloaded ? "cloud-offline-outline" : "download-outline"}
                size={22}
                color={colors.gray[700]}
              />
              <Text style={styles.menuItemText}>
                {isRetreatDownloaded ? 'Remove Offline Download' : 'Download for offline listening'}
              </Text>
            </TouchableOpacity>

            {/* Transcript shortcut — moved here from the (now-removed) top bar
                so it stays accessible alongside the download action. */}
            {!isDesktop && retreat.transcripts && retreat.transcripts.length > 0 && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    router.push(`/(tabs)/(groups)/transcript/${retreat.id}` as any);
                  }}
                >
                  <Ionicons name="document-text-outline" size={22} color={colors.gray[700]} />
                  <Text style={styles.menuItemText}>{t('transcript.open') || 'Open transcript'}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ZIP Download Option - Only on web/desktop */}
            {Platform.OS === 'web' && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleDownloadRetreatZip}>
                  <Ionicons name="archive-outline" size={22} color={colors.gray[700]} />
                  <Text style={styles.menuItemText}>Download as ZIP</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Read Along Modal (mobile) — embeds the AudioPlayer at the bottom
          so the user can pause / skip 10s / change track / change speed
          without leaving the read-along view. */}
      <Modal
        visible={readAlongModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseReadAlong}
      >
        <SafeAreaView style={styles.readAlongModal}>
          <View style={styles.readAlongContent}>
            {readAlongLoading ? (
              <View style={styles.readAlongModalLoading}>
                <ActivityIndicator size="large" color={colors.burgundy[500]} />
              </View>
            ) : readAlongData ? (
              <ReadAlongViewer
                readAlongData={readAlongData}
                onClose={handleCloseReadAlong}
                bottomInset={145 + insets.bottom + 16}
              />
            ) : (
              <View style={styles.readAlongModalLoading}>
                <Text style={{ color: colors.gray[500] }}>
                  {t('readAlong.unavailable') || 'Read Along not available for this track'}
                </Text>
                <TouchableOpacity onPress={handleCloseReadAlong} style={{ marginTop: 16 }}>
                  <Text style={{ color: colors.burgundy[500], fontWeight: '600' }}>
                    {t('common.goBack') || 'Go Back'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {/* Embedded player — bottom inset only, no tab bar inside the modal.
              The "read" button toggles the modal closed so the user can
              return to the regular track list. */}
          <AudioPlayer
            bottom={insets.bottom}
            languageLabel={currentLanguageMode ? getLanguageLabel(currentLanguageMode) : undefined}
            onLanguagePress={() => setShowLanguageDropdown(true)}
            onReadPress={handleCloseReadAlong}
            onBookmarkPress={currentTrack && isAuthenticated ? toggleCurrentTrackBookmark : undefined}
            isBookmarked={isCurrentTrackBookmarked}
          />
        </SafeAreaView>
      </Modal>

      {/* Mobile language popup — anchored above the player toolbar.
          Replaces the hero pill on mobile; desktop still uses the
          floating pill in the hero. The bottom offset matches the
          player's own bottom offset (49 + safe area when the regular
          player is showing, just safe area inside the read-along
          modal) plus enough clearance to sit above the toolbar row. */}
      {!isDesktop && (
        <Modal
          visible={showLanguageDropdown}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLanguageDropdown(false)}
        >
          <Pressable
            style={styles.languagePopupBackdrop}
            onPress={() => setShowLanguageDropdown(false)}
          >
            <View
              style={[
                styles.languagePopupContainer,
                {
                  bottom:
                    (readAlongModalVisible
                      ? insets.bottom
                      : Platform.OS === 'ios'
                        ? 49 + insets.bottom
                        : 49) + 56,
                },
              ]}
            >
              {(['en', 'en-pt', 'pt'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.languageDropdownItem,
                    currentLanguageMode === mode && styles.languageDropdownItemActive,
                  ]}
                  onPress={() => {
                    updateLanguagePreference(mode);
                    setShowLanguageDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.languageDropdownItemText,
                      currentLanguageMode === mode && styles.languageDropdownItemTextActive,
                    ]}
                  >
                    {getLanguageLabel(mode)}
                  </Text>
                  {currentLanguageMode === mode && (
                    <Ionicons name="checkmark" size={16} color={colors.burgundy[500]} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        buttons={modalState.buttons}
        onClose={hideModal}
        icon={modalState.icon}
      />
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
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  headerDesktop: {
    paddingLeft: 23,
    paddingRight: 40,
    paddingTop: 42,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonError: {
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 2,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 22,
    fontFamily: 'MinionPro',
    color: colors.burgundy[500],
    fontVariant: ['small-caps'] as any,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.gray[600],
    marginTop: 2,
  },
  menuButton: {
    padding: 8,
  },
  downloadBanner: {
    backgroundColor: colors.burgundy[50],
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadBannerContent: {
    flex: 1,
  },
  downloadBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  downloadBannerTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.burgundy[700],
  },
  downloadBannerSubtext: {
    fontSize: 12,
    color: colors.burgundy[600],
    marginTop: 6,
  },
  downloadBannerText: {
    fontSize: 14,
    color: colors.burgundy[700],
    marginLeft: 8,
    flex: 1,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.burgundy[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.burgundy[500],
    borderRadius: 3,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  languageButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray[700],
    marginRight: 4,
  },
  languageDropdownContainer: {
    position: 'relative',
    marginLeft: 8,
    zIndex: 100,
  },
  languageDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 200,
    overflow: 'hidden',
  },
  languageDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[100],
  },
  languageDropdownItemActive: {
    backgroundColor: colors.burgundy[50],
  },
  languageDropdownItemText: {
    fontSize: 14,
    color: colors.gray[700],
  },
  languageDropdownItemTextActive: {
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  content: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    padding: 16,
  },
  heroContainer: {
    alignSelf: 'stretch',
    height: HERO_HEIGHT,
    backgroundColor: colors.gray[200],
    // Break out of scrollContent's horizontal padding (16) so the hero spans
    // edge to edge AND extends to the very top of the screen (under the
    // status bar) — there is no fixed top bar on mobile anymore.
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 12,
    // Visible overflow so the floating action circles can extend past the
    // bottom edge of the photo, sitting half over the image and half over
    // the white background — exactly like the mockup.
    overflow: 'visible',
  },
  floatingTopButton: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  floatingTopButtonLeft: {
    left: 12,
  },
  floatingTopButtonRight: {
    right: 12,
  },
  // Group of floating top-right controls (language pill + overflow menu).
  // Positioned absolutely over the hero on both mobile and desktop now
  // that the desktop top bar has been removed.
  floatingTopRightCluster: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    zIndex: 20,
  },
  // Same circle as floatingTopButton but rendered inline inside the
  // cluster — no absolute positioning.
  floatingTopButtonInline: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Translucent pill version of the language button so it reads cleanly
  // over a hero photo.
  languageDropdownContainerFloating: {
    position: 'relative',
    zIndex: 100,
  },
  languageButtonFloating: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  languagePopupBackdrop: {
    flex: 1,
  },
  languagePopupContainer: {
    position: 'absolute',
    right: 16,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 200,
    overflow: 'hidden',
  },
  languageButtonFloatingText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.white,
    marginRight: 6,
  },
  mobileDownloadBannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 15,
  },
  // Inner wrapper that clips the image. Kept separate from heroContainer
  // so we can still let the action circles overflow the bottom edge.
  heroImageWrapper: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  heroActionRow: {
    position: 'absolute',
    right: 16,
    bottom: -18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  heroActionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.burgundy[500],
    justifyContent: 'center',
    alignItems: 'center',
    // White ring so the circles read clearly against either the photo or
    // the page background.
    borderWidth: 2,
    borderColor: colors.white,
  },
  eventTitleSection: {
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.burgundy[500],
    marginBottom: 8,
  },
  eventTitleText: {
    fontFamily: 'EBGaramond_600SemiBold',
    fontSize: 26,
    color: colors.burgundy[500],
    lineHeight: 32,
  },
  eventSpeakerText: {
    fontFamily: 'EBGaramond_600SemiBold',
    fontSize: 18,
    color: colors.gray[700],
    marginTop: 6,
  },
  eventTitleMetaText: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 4,
  },
  sessionHeader: {
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  sessionHeaderSubsequent: {
    marginTop: 32,
  },
  sessionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  // Two-tab content switcher (Videos | Audio). Underline on the active
  // tab, no background — sits flush above the content.
  contentTabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
    marginTop: 4,
    marginBottom: 12,
  },
  contentTab: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginRight: 28,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  contentTabActive: {
    borderBottomColor: colors.burgundy[500],
  },
  contentTabText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: colors.gray[500],
    textTransform: 'uppercase',
  },
  contentTabTextActive: {
    color: colors.burgundy[500],
  },

  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 8,
    paddingLeft: 4,
    marginBottom: 0,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  currentTrackItem: {
    backgroundColor: colors.burgundy[50],
    borderLeftColor: colors.burgundy[500],
  },
  trackItemSiblingAbove: {
    borderBottomColor: colors.gray[100],
  },
  trackNumberContainer: {
    minWidth: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: 20,
  },
  trackNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.gray[600],
  },
  currentTrackNumber: {
    color: colors.burgundy[600],
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 15,
    fontFamily: 'EBGaramond_400Regular',
    color: colors.gray[700],
    marginBottom: 4,
  },
  currentTrackTitle: {
    color: colors.burgundy[600],
    fontWeight: '600',
    fontFamily: 'EBGaramond_600SemiBold',
  },
  trackSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackDuration: {
    fontSize: 12,
    color: colors.gray[500],
  },
  langBadge: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    marginRight: 4,
  },
  langBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  trackRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
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
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    minWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.gray[700],
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginHorizontal: 16,
  },
  // Desktop layout: list of related events on the left, event content on
  // the right. The narrow right rail (logo + account initial) is mounted
  // by DesktopShell at the app level, not here.
  masterDetailContainer: {
    flex: 1,
    flexDirection: 'row' as const,
  },
  desktopRelatedPanel: {
    width: 320,
    flexShrink: 0,
  },
  desktopEventContent: {
    flex: 1,
    minWidth: 0,
  },
  // Kept around in case any code still references them — both the old
  // master/detail and the new layout share the same outer container.
  masterPanel: {
    flex: 0.4,
    borderRightWidth: 1,
    borderRightColor: colors.gray[200],
  },
  detailPanel: {
    flex: 0.6,
  },
  selectedTrackItem: {
    backgroundColor: colors.gray[100],
    borderLeftColor: colors.burgundy[500],
  },
  readAlongModal: {
    flex: 1,
    backgroundColor: colors.white,
  },
  // Wraps the read-along scroll area inside the modal. Padding for the
  // overlay AudioPlayer is applied inside ReadAlongViewer's scrollContent
  // (via the bottomInset prop) so the text scrolls all the way down to the
  // player's slider rather than stopping in a white band above it.
  readAlongContent: {
    flex: 1,
  },
  readAlongModalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transcriptOnlySection: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  transcriptOnlyIcon: {
    marginBottom: 16,
    opacity: 0.85,
  },
  transcriptOnlyMessage: {
    fontFamily: 'EBGaramond_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 360,
  },
  transcriptOnlyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.burgundy[500],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  transcriptOnlyButtonText: {
    fontFamily: 'EBGaramond_600SemiBold',
    fontSize: 16,
    color: colors.white,
  },
  relatedPublicationsSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
  },
  relatedPublicationsTitle: {
    fontFamily: 'EBGaramond_600SemiBold',
    fontSize: 18,
    color: colors.gray[700],
    marginBottom: 12,
  },
  relatedPublicationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  relatedPubCover: {
    width: 40,
    height: 56,
    borderRadius: 3,
    backgroundColor: colors.gray[100],
  },
  relatedPubCoverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedPubTitle: {
    fontFamily: 'EBGaramond_500Medium',
    fontSize: 15,
    color: colors.gray[700],
    marginLeft: 12,
    flex: 1,
  },
});
