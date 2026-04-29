import { useLanguage } from '@/contexts/LanguageContext';
import progressService from '@/services/progressService';
import retreatService from '@/services/retreatService';
import videoDownloadService, { type VideoDownloadStatus } from '@/services/videoDownloadService';
import videoPreferencesService from '@/services/videoPreferencesService';
import type { Bookmark, Session } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { getNetworkStateAsync, NetworkStateType } from 'expo-network';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const colors = {
  burgundy: { 500: '#9b1b1b' },
  gray: { 200: '#e5e7eb', 400: '#9ca3af', 600: '#4b5563', 800: '#2c2c2c' },
  white: '#ffffff',
  black: '#000000',
};

interface VideoPlayerProps {
  /** Session whose video is being played. The modal closes when this becomes null. */
  session: Session | null;
  onClose: () => void;
  /** Optional callback when playback reaches the end. */
  onComplete?: () => void;
  /**
   * Per-session-of-app-use ref to remember whether the user has already
   * approved cellular playback this session. Caller owns the ref so it
   * survives remounts when switching between videos in the same screen visit.
   */
  cellularAcceptedRef?: React.MutableRefObject<boolean>;
}

type CellularGate = 'pending' | 'allowed' | 'blocked';

const PROGRESS_SAVE_INTERVAL_MS = 5_000;
const COMPLETE_THRESHOLD_RATIO = 0.97;
/**
 * 5 minutes of forward HLS buffer regardless of network type — survives
 * tunnels and dead zones while driving without exploding RAM. The buffer is
 * data downloaded earlier than strictly needed; the underlying download
 * volume is dominated by the video itself, not the buffer depth.
 */
const FORWARD_BUFFER_SECONDS = 300;

/**
 * Synthetic key used to store video progress and bookmarks separately from
 * audio. Audio progress is keyed by trackId; video progress by this synthetic
 * "session-{id}" key, so the two never collide.
 */
function videoProgressKey(sessionId: string): string {
  return `session-video-${sessionId}`;
}

/**
 * Save UserProgress for a session video, preserving any existing bookmarks.
 *
 * Always persists locally (offline-first); also fires a fire-and-forget
 * POST to the backend so the position survives reinstalls and syncs to
 * other devices the same user is signed in on.
 */
async function saveVideoProgress(
  sessionId: string,
  position: number,
  duration: number,
  completed: boolean,
): Promise<void> {
  try {
    const key = videoProgressKey(sessionId);
    const existing = await progressService.getProgress(key);
    await progressService.saveProgress({
      trackId: key,
      position,
      completed,
      lastPlayed: new Date().toISOString(),
      bookmarks: existing?.bookmarks ?? [],
    });
  } catch {
    // Best-effort — progress saving must never crash playback.
  }
  // Push to backend in parallel; never block playback on network.
  progressService
    .saveVideoProgressRemote(sessionId, position, duration, completed)
    .catch(() => undefined);
}

export function VideoPlayer({ session, onClose, onComplete, cellularAcceptedRef }: VideoPlayerProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  // hlsUrl points at our backend's HLS proxy on every platform — see the
  // playback-URL-load effect below. The legacy name is kept so all existing
  // event/render code keeps working without churn.
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resumePosition, setResumePosition] = useState<number>(0);
  const [cellularGate, setCellularGate] = useState<CellularGate>('allowed');
  const [isLocal, setIsLocal] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<VideoDownloadStatus>({ state: 'idle' });
  const [bookmarkModalVisible, setBookmarkModalVisible] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [bookmarkSavedAt, setBookmarkSavedAt] = useState<number | null>(null);
  const [bookmarkListVisible, setBookmarkListVisible] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const lastSavedAtRef = useRef<number>(0);
  const completedRef = useRef<boolean>(false);

  // Build the player. We pass `null` until we have a URL — expo-video accepts
  // a null source and waits for replace(). Increase forward buffer so brief
  // network outages (tunnels, weak coverage) don't stall playback.
  const player = useVideoPlayer(null, (p) => {
    p.timeUpdateEventInterval = 1;
    p.staysActiveInBackground = false;
    p.bufferOptions = {
      preferredForwardBufferDuration: FORWARD_BUFFER_SECONDS,
    };
  });

  // Load presigned URL + saved progress whenever the session changes.
  // First gate on cellular policy: refuse if disallowed in settings, prompt
  // once per session if warning is enabled.
  useEffect(() => {
    let cancelled = false;
    completedRef.current = false;
    setErrorMsg(null);
    setHlsUrl(null);
    setResumePosition(0);
    setCellularGate('allowed');
    setIsLocal(false);
    setDownloadStatus({ state: 'idle' });

    if (!session) return;

    (async () => {
      // 0. Prefer a local downloaded copy if we have one — no network gate, no
      //    presigned URL roundtrip. Just play the file directly.
      const localUri = await videoDownloadService.getLocalUri(session.id);
      if (cancelled) return;
      if (localUri) {
        setIsLocal(true);
        setHlsUrl(localUri);
        setDownloadStatus({ state: 'done', localUri, size: 0 });
        const progress = await progressService.getProgress(videoProgressKey(session.id));
        if (cancelled) return;
        const duration = session.videoDurationSeconds ?? 0;
        const saved = progress?.position ?? 0;
        const safeResume =
          duration > 0 && saved > 0 && saved < duration * COMPLETE_THRESHOLD_RATIO
            ? saved
            : 0;
        setResumePosition(safeResume);
        return;
      }

      // 1. Check the network type.
      let isCellular = false;
      try {
        const netState = await getNetworkStateAsync();
        isCellular = netState.type === NetworkStateType.CELLULAR;
      } catch {
        // If detection fails, treat as wifi (don't block playback).
      }
      if (cancelled) return;

      if (isCellular) {
        const [allowOnCellular, warnOnCellular] = await Promise.all([
          videoPreferencesService.getAllowOnCellular(),
          videoPreferencesService.getWarnOnCellular(),
        ]);
        if (cancelled) return;

        if (!allowOnCellular) {
          setErrorMsg(t('video.cellularBlockedMessage') || 'Video playback over cellular is disabled in Settings.');
          setCellularGate('blocked');
          return;
        }

        const alreadyAccepted = cellularAcceptedRef?.current === true;
        if (warnOnCellular && !alreadyAccepted) {
          setCellularGate('pending');
          const accepted = await new Promise<boolean>((resolve) => {
            Alert.alert(
              t('video.cellularWarningTitle') || 'Mobile data',
              t('video.cellularWarningMessage') ||
                'You are not connected to Wi-Fi. Long videos can use a substantial amount of data. Continue?',
              [
                { text: t('common.cancel') || 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: t('video.cellularWarningContinue') || 'Continue', onPress: () => resolve(true) },
              ],
              { cancelable: false },
            );
          });
          if (cancelled) return;
          if (!accepted) {
            setCellularGate('blocked');
            onClose();
            return;
          }
          if (cellularAcceptedRef) cellularAcceptedRef.current = true;
        }
        setCellularGate('allowed');
      }

      // 2. Fetch playback URL + local + remote progress in parallel.
      const [urlResult, localProgress, remoteProgress] = await Promise.all([
        retreatService.getSessionVideoPlaybackUrls(session.id),
        progressService.getProgress(videoProgressKey(session.id)),
        progressService.getVideoProgressRemote(session.id),
      ]);

      if (cancelled) return;

      const sourceUrl = urlResult.proxyHls ?? urlResult.hls;
      if (!urlResult.success || !sourceUrl) {
        setErrorMsg(urlResult.error ?? t('video.loadError') ?? 'Failed to load video');
        return;
      }

      // Pick the more recent of {local, remote} as the resume position.
      // If they disagree, the newer one wins — that's how a phone session
      // followed by a web session should pick up. lastPlayed is an ISO
      // string locally; updatedAt is an ISO string remotely.
      const localTs = localProgress?.lastPlayed
        ? Date.parse(localProgress.lastPlayed)
        : 0;
      const remoteTs = remoteProgress?.updatedAt
        ? Date.parse(remoteProgress.updatedAt)
        : 0;
      const remoteWins = remoteTs > localTs;
      const savedPosition = remoteWins
        ? remoteProgress!.positionSeconds
        : (localProgress?.position ?? 0);

      // If the remote was newer, mirror it into local storage so subsequent
      // offline opens see the same value without needing the network.
      if (remoteWins && remoteProgress) {
        const key = videoProgressKey(session.id);
        const existing = await progressService.getProgress(key);
        await progressService.saveProgress({
          trackId: key,
          position: remoteProgress.positionSeconds,
          completed: remoteProgress.completedAt != null,
          lastPlayed: remoteProgress.updatedAt ?? new Date().toISOString(),
          bookmarks: existing?.bookmarks ?? [],
        });
      }

      // Resume from saved position when not basically at the end.
      const duration = urlResult.durationSeconds ?? session.videoDurationSeconds ?? 0;
      const safeResume =
        duration > 0 && savedPosition > 0 && savedPosition < duration * COMPLETE_THRESHOLD_RATIO
          ? Math.floor(savedPosition)
          : 0;
      setResumePosition(safeResume);

      // Single playback path: backend HLS proxy. Each variant + segment URL
      // routes back through our backend, which signs the upstream Bunny URL
      // per request and 302-redirects. Player gets full HLS + ABR + lockscreen
      // (native), web gets full HLS via expo-video's hls.js bundle, and the
      // MAT in the URL means tokens expire in ~4h with no shareable forever-
      // links.
      setHlsUrl(sourceUrl);
    })();

    return () => {
      cancelled = true;
    };
  }, [session, t, cellularAcceptedRef, onClose]);

  // Replace the player source when the URL is ready, then seek to resume.
  useEffect(() => {
    if (!hlsUrl || !player) return;
    try {
      player.replace({ uri: hlsUrl });
      // expo-video applies seek after the source loads — currentTime is settable.
      if (resumePosition > 0) {
        player.currentTime = resumePosition;
      }
      player.play();
    } catch (e) {
      console.warn('Video player replace failed', e);
      setErrorMsg(t('video.loadError') ?? 'Failed to load video');
    }
  }, [hlsUrl, player, resumePosition, t]);

  // Subscribe to time updates to save progress (no rerender — side-effect only).
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!session) return;
    const duration = player.duration ?? session.videoDurationSeconds ?? 0;
    if (!duration || currentTime <= 0) return;

    // Throttle progress saves to once every 5 seconds of playback.
    const now = Date.now();
    if (now - lastSavedAtRef.current < PROGRESS_SAVE_INTERVAL_MS) return;
    lastSavedAtRef.current = now;

    const completed = currentTime >= duration * COMPLETE_THRESHOLD_RATIO;
    saveVideoProgress(session.id, currentTime, duration, completed);

    if (completed && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  });

  const bookmarksKeyFor = (sessionId: string) => `bookmarks_${videoProgressKey(sessionId)}`;

  const loadBookmarks = async (sessionId: string) => {
    try {
      const raw = await AsyncStorage.getItem(bookmarksKeyFor(sessionId));
      const list: Bookmark[] = raw ? JSON.parse(raw) : [];
      setBookmarks(list.sort((a, b) => a.position - b.position));
    } catch {
      setBookmarks([]);
    }
  };

  // Reload bookmarks whenever the session changes.
  useEffect(() => {
    if (session) loadBookmarks(session.id);
    else setBookmarks([]);
  }, [session]);

  const openBookmarkList = async () => {
    if (!session) return;
    await loadBookmarks(session.id);
    try {
      player?.pause();
    } catch {
      // ignore
    }
    setBookmarkListVisible(true);
  };

  const seekToBookmark = (bookmark: Bookmark) => {
    if (!player) return;
    try {
      player.currentTime = bookmark.position;
      player.play();
    } catch {
      // ignore
    }
    setBookmarkListVisible(false);
  };

  const deleteBookmark = async (bookmarkId: string) => {
    if (!session) return;
    const filtered = bookmarks.filter((b) => b.id !== bookmarkId);
    setBookmarks(filtered);
    try {
      await AsyncStorage.setItem(bookmarksKeyFor(session.id), JSON.stringify(filtered));
    } catch {
      // ignore
    }
  };

  const openBookmarkModal = () => {
    if (!session || !player) return;
    setBookmarkSavedAt(player.currentTime ?? 0);
    setBookmarkNote('');
    try {
      player.pause();
    } catch {
      // ignore
    }
    setBookmarkModalVisible(true);
  };

  const saveBookmark = async () => {
    if (!session || bookmarkSavedAt === null) return;
    const note = bookmarkNote.trim();
    if (note.length === 0) return;
    try {
      const key = bookmarksKeyFor(session.id);
      const existing = await AsyncStorage.getItem(key);
      const list: Bookmark[] = existing ? JSON.parse(existing) : [];
      list.push({
        id: `bookmark_${Date.now()}`,
        trackId: videoProgressKey(session.id),
        position: Math.floor(bookmarkSavedAt),
        note,
        createdAt: new Date().toISOString(),
      });
      await AsyncStorage.setItem(key, JSON.stringify(list));
      setBookmarks(list.sort((a, b) => a.position - b.position));
      setBookmarkModalVisible(false);
      setBookmarkNote('');
      setBookmarkSavedAt(null);
    } catch (err) {
      console.warn('Failed to save bookmark', err);
    }
  };

  const handleDownload = async () => {
    if (!session) return;
    try {
      await videoDownloadService.download(session.id, '720p', (status) => {
        setDownloadStatus(status);
      });
      setIsLocal(true);
    } catch (err) {
      console.warn('Video download failed', err);
    }
  };

  const handleDeleteLocal = async () => {
    if (!session) return;
    Alert.alert(
      t('video.deleteOfflineTitle') || 'Remove from device',
      t('video.deleteOfflineMessage') || 'This video will be removed from offline storage. You can download it again later.',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common.remove') || 'Remove',
          style: 'destructive',
          onPress: async () => {
            await videoDownloadService.delete(session.id);
            setDownloadStatus({ state: 'idle' });
            // Don't switch to streaming mid-playback — let the user reopen.
          },
        },
      ],
    );
  };

  // Save progress one last time when closing (so quick taps don't lose state).
  const handleClose = () => {
    if (session && player) {
      const currentTime = player.currentTime ?? 0;
      const duration = player.duration ?? session.videoDurationSeconds ?? 0;
      if (currentTime > 0 && duration > 0) {
        saveVideoProgress(
          session.id,
          currentTime,
          duration,
          currentTime >= duration * COMPLETE_THRESHOLD_RATIO,
        );
      }
      try {
        player.pause();
      } catch {
        // Ignore — player may already be torn down.
      }
    }
    onClose();
  };

  return (
    <Modal
      visible={session !== null}
      animationType="slide"
      onRequestClose={handleClose}
      supportedOrientations={['portrait', 'landscape']}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={handleClose} style={styles.iconButton} accessibilityLabel={t('common.close') || 'Close'}>
            <Ionicons name="chevron-down" size={28} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {session?.name ?? ''}
          </Text>
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              onPress={openBookmarkList}
              style={styles.iconButton}
              accessibilityLabel={t('video.bookmarks') || 'Bookmarks'}
              disabled={!session || !hlsUrl}
            >
              <Ionicons
                name={bookmarks.length > 0 ? 'bookmarks' : 'bookmarks-outline'}
                size={22}
                color={colors.white}
              />
              {bookmarks.length > 0 && (
                <Text style={styles.bookmarkBadge}>{bookmarks.length}</Text>
              )}
            </TouchableOpacity>
          )}
          {Platform.OS === 'web' ? (
            <View style={styles.iconButton} />
          ) : isLocal ? (
            <TouchableOpacity
              onPress={handleDeleteLocal}
              style={styles.iconButton}
              accessibilityLabel={t('video.removeOffline') || 'Remove offline copy'}
            >
              <Ionicons name="checkmark-circle" size={26} color={colors.white} />
            </TouchableOpacity>
          ) : downloadStatus.state === 'downloading' ? (
            <View style={styles.iconButton}>
              <Text style={styles.downloadProgressText}>
                {Math.round(downloadStatus.progress * 100)}%
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleDownload}
              style={styles.iconButton}
              accessibilityLabel={t('video.saveOffline') || 'Save for offline'}
              disabled={!session}
            >
              <Ionicons name="cloud-download-outline" size={26} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>

        {/* Bookmarks list modal */}
        <Modal
          visible={bookmarkListVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setBookmarkListVisible(false)}
        >
          <View style={styles.bookmarkListOverlay}>
            <View style={styles.bookmarkListSheet}>
              <View style={styles.bookmarkListHeader}>
                <Text style={styles.bookmarkListTitle}>
                  {t('video.bookmarks') || 'Bookmarks'}
                </Text>
                <TouchableOpacity onPress={() => setBookmarkListVisible(false)} style={styles.iconButton}>
                  <Ionicons name="close" size={24} color={colors.gray[800]} />
                </TouchableOpacity>
              </View>
              {bookmarks.length === 0 ? (
                <View style={styles.bookmarkEmpty}>
                  <Ionicons name="bookmarks-outline" size={48} color={colors.gray[400]} />
                  <Text style={styles.bookmarkEmptyText}>
                    {t('video.bookmarksEmpty') || 'No bookmarks yet'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={bookmarks}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  renderItem={({ item }) => (
                    <View style={styles.bookmarkListRow}>
                      <TouchableOpacity
                        style={styles.bookmarkListPlay}
                        onPress={() => seekToBookmark(item)}
                      >
                        <Ionicons name="play-circle-outline" size={28} color={colors.burgundy[500]} />
                        <View style={styles.bookmarkListText}>
                          <Text style={styles.bookmarkListTime}>{formatTime(item.position)}</Text>
                          <Text style={styles.bookmarkListNote} numberOfLines={2}>
                            {item.note}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteBookmark(item.id)}
                        style={styles.iconButton}
                        accessibilityLabel={t('common.remove') || 'Remove'}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.gray[600]} />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
              <TouchableOpacity
                style={styles.bookmarkListAdd}
                onPress={() => {
                  setBookmarkListVisible(false);
                  openBookmarkModal();
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.white} />
                <Text style={styles.bookmarkListAddText}>
                  {t('video.addBookmarkAtCurrent') || 'Add bookmark at current time'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Add-bookmark modal — paused video stays visible behind it */}
        <Modal
          visible={bookmarkModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setBookmarkModalVisible(false)}
        >
          <View style={styles.bookmarkOverlay}>
            <View style={styles.bookmarkSheet}>
              <Text style={styles.bookmarkTitle}>
                {t('video.addBookmark') || 'Add bookmark'}
              </Text>
              <Text style={styles.bookmarkTime}>
                {bookmarkSavedAt !== null ? formatTime(bookmarkSavedAt) : ''}
              </Text>
              <TextInput
                style={styles.bookmarkInput}
                value={bookmarkNote}
                onChangeText={setBookmarkNote}
                placeholder={t('video.bookmarkPlaceholder') || 'Add a note for this moment'}
                placeholderTextColor={colors.gray[400]}
                multiline
                autoFocus
              />
              <View style={styles.bookmarkActions}>
                <TouchableOpacity
                  style={styles.bookmarkCancel}
                  onPress={() => setBookmarkModalVisible(false)}
                >
                  <Text style={styles.bookmarkCancelText}>{t('common.cancel') || 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.bookmarkSave,
                    bookmarkNote.trim().length === 0 && styles.bookmarkSaveDisabled,
                  ]}
                  onPress={saveBookmark}
                  disabled={bookmarkNote.trim().length === 0}
                >
                  <Text style={styles.bookmarkSaveText}>{t('common.ok') || 'OK'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.videoContainer}>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={48} color={colors.gray[400]} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : hlsUrl ? (
            <VideoView
              style={styles.video}
              player={player}
              allowsFullscreen
              allowsPictureInPicture={Platform.OS !== 'web'}
              contentFit="contain"
              nativeControls
            />
          ) : (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.white} />
              <Text style={styles.loadingText}>{t('video.loading') || 'Loading video…'}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: colors.black,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadProgressText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingBox: {
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.white,
    fontSize: 14,
  },
  errorBox: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  errorText: {
    color: colors.gray[400],
    fontSize: 14,
    textAlign: 'center',
  },
  bookmarkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  bookmarkSheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  bookmarkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[800],
  },
  bookmarkTime: {
    fontSize: 14,
    color: colors.burgundy[500],
    fontWeight: '600',
  },
  bookmarkInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: colors.gray[800],
    textAlignVertical: 'top',
  },
  bookmarkActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  bookmarkCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  bookmarkCancelText: {
    fontSize: 15,
    color: colors.gray[600],
  },
  bookmarkSave: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.burgundy[500],
  },
  bookmarkSaveDisabled: {
    opacity: 0.4,
  },
  bookmarkSaveText: {
    fontSize: 15,
    color: colors.white,
    fontWeight: '600',
  },
  bookmarkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.burgundy[500],
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  bookmarkListOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  bookmarkListSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 16,
  },
  bookmarkListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  bookmarkListTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.gray[800],
  },
  bookmarkEmpty: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  bookmarkEmptyText: {
    fontSize: 14,
    color: colors.gray[400],
  },
  bookmarkListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  bookmarkListPlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookmarkListText: {
    flex: 1,
  },
  bookmarkListTime: {
    fontSize: 13,
    color: colors.burgundy[500],
    fontWeight: '600',
    marginBottom: 2,
  },
  bookmarkListNote: {
    fontSize: 14,
    color: colors.gray[800],
  },
  bookmarkListAdd: {
    margin: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.burgundy[500],
    borderRadius: 10,
  },
  bookmarkListAddText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
});

// Inline helper duplicated from AudioPlayer to avoid coupling.
function formatTime(seconds: number): string {
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
