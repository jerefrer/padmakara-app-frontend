import AsyncStorage from '@react-native-async-storage/async-storage';
import progressService from './progressService';
import type { UserProgress, Bookmark } from '@/types';

const makeProgress = (overrides: Partial<UserProgress> = {}): UserProgress => ({
  trackId: 't1',
  position: 0,
  completed: false,
  lastPlayed: '2026-05-08T10:00:00Z',
  bookmarks: [],
  ...overrides,
});

const makeBookmark = (overrides: Partial<Bookmark> = {}): Bookmark => ({
  id: 'b1',
  trackId: 't1',
  position: 30,
  createdAt: '2026-05-08T10:00:00Z',
  ...overrides,
});

describe('progressService', () => {
  describe('saveProgress / getProgress / deleteProgress', () => {
    it('C1 — saveProgress writes the JSON object under progress_${trackId}', async () => {
      const p = makeProgress({ trackId: 'abc', position: 120 });
      await progressService.saveProgress(p);
      const raw = await AsyncStorage.getItem('progress_abc');
      expect(JSON.parse(raw!)).toEqual(p);
    });

    it('C2 — getProgress returns null for a missing key', async () => {
      expect(await progressService.getProgress('missing')).toBeNull();
    });

    it('C3 — getProgress returns the parsed value for an existing key', async () => {
      const p = makeProgress({ trackId: 'abc', position: 90 });
      await progressService.saveProgress(p);
      expect(await progressService.getProgress('abc')).toEqual(p);
    });

    it('C5 — deleteProgress removes only that key', async () => {
      await progressService.saveProgress(makeProgress({ trackId: 'a' }));
      await progressService.saveProgress(makeProgress({ trackId: 'b' }));
      await progressService.deleteProgress('a');
      expect(await progressService.getProgress('a')).toBeNull();
      expect(await progressService.getProgress('b')).not.toBeNull();
    });

    it('C11 — saveProgress twice with same trackId: last write wins', async () => {
      await progressService.saveProgress(makeProgress({ trackId: 't', position: 10, lastPlayed: '2026-05-08T10:00:00Z' }));
      await progressService.saveProgress(makeProgress({ trackId: 't', position: 20, lastPlayed: '2026-05-08T11:00:00Z' }));
      const p = await progressService.getProgress('t');
      expect(p?.position).toBe(20);
      expect(p?.lastPlayed).toBe('2026-05-08T11:00:00Z');
    });
  });

  describe('getAllProgress', () => {
    it('C4 — aggregates progress_* keys, ignores bookmark keys', async () => {
      await progressService.saveProgress(makeProgress({ trackId: 't1' }));
      await progressService.saveProgress(makeProgress({ trackId: 't2' }));
      await progressService.saveProgress(makeProgress({ trackId: 't3' }));
      await AsyncStorage.setItem('bookmarks_t1', JSON.stringify([makeBookmark()]));
      const all = await progressService.getAllProgress();
      expect(all).toHaveLength(3);
      expect(all.map((p) => p.trackId).sort()).toEqual(['t1', 't2', 't3']);
    });
  });

  describe('bookmarks', () => {
    it('C6 — addBookmark appends to existing list', async () => {
      const b1 = makeBookmark({ id: 'b1' });
      const b2 = makeBookmark({ id: 'b2', position: 60 });
      await progressService.addBookmark(b1);
      await progressService.addBookmark(b2);
      const list = await progressService.getBookmarks('t1');
      expect(list.map((b) => b.id)).toEqual(['b1', 'b2']);
    });

    it('C7 — deleteBookmark removes only the matching id', async () => {
      const b1 = makeBookmark({ id: 'b1' });
      const b2 = makeBookmark({ id: 'b2', position: 60 });
      await progressService.addBookmark(b1);
      await progressService.addBookmark(b2);
      await progressService.deleteBookmark('t1', 'b1');
      const list = await progressService.getBookmarks('t1');
      expect(list.map((b) => b.id)).toEqual(['b2']);
    });
  });

  describe('queries', () => {
    it('C8 — getRecentActivity returns top N by lastPlayed desc', async () => {
      await progressService.saveProgress(makeProgress({ trackId: 'a', lastPlayed: '2026-05-01T10:00:00Z' }));
      await progressService.saveProgress(makeProgress({ trackId: 'b', lastPlayed: '2026-05-03T10:00:00Z' }));
      await progressService.saveProgress(makeProgress({ trackId: 'c', lastPlayed: '2026-05-02T10:00:00Z' }));
      await progressService.saveProgress(makeProgress({ trackId: 'd', lastPlayed: '2026-05-04T10:00:00Z' }));
      const recent = await progressService.getRecentActivity(2);
      expect(recent.map((p) => p.trackId)).toEqual(['d', 'b']);
    });

    it('C9 — getContinueListening filters to position>30 && !completed', async () => {
      await progressService.saveProgress(makeProgress({ trackId: 'low', position: 10, completed: false }));
      await progressService.saveProgress(makeProgress({ trackId: 'done', position: 500, completed: true }));
      await progressService.saveProgress(makeProgress({ trackId: 'middle', position: 90, completed: false }));
      const list = await progressService.getContinueListening(10);
      expect(list.map((p) => p.trackId)).toEqual(['middle']);
    });
  });

  describe('clearAllData', () => {
    it('C10 — removes progress_*, bookmarks_*, pdf_progress_* but leaves unrelated keys', async () => {
      await progressService.saveProgress(makeProgress({ trackId: 't1' }));
      await AsyncStorage.setItem('bookmarks_t1', JSON.stringify([makeBookmark()]));
      await AsyncStorage.setItem('pdf_progress_x', JSON.stringify({}));
      await AsyncStorage.setItem('app_language', 'en');
      const result = await progressService.clearAllData();
      expect(result.success).toBe(true);
      expect(await AsyncStorage.getItem('progress_t1')).toBeNull();
      expect(await AsyncStorage.getItem('bookmarks_t1')).toBeNull();
      expect(await AsyncStorage.getItem('pdf_progress_x')).toBeNull();
      expect(await AsyncStorage.getItem('app_language')).toBe('en');
    });
  });

  describe('completion flag', () => {
    it('C12 — saveProgress with position >= duration-1 retains completed=true', async () => {
      // The flag is computed by the caller (AudioPlayerContext.saveProgress);
      // here we verify the service round-trips the flag faithfully.
      const p = makeProgress({ trackId: 't1', position: 599, completed: true });
      await progressService.saveProgress(p);
      const got = await progressService.getProgress('t1');
      expect(got?.completed).toBe(true);
    });
  });
});

// ─── Remote audio progress (cross-device sync) ─────────────────────────

import apiService from './apiService';

jest.mock('./apiService', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const apiPost = apiService.post as jest.Mock;
const apiGet = apiService.get as jest.Mock;

describe('progressService — remote audio progress', () => {
  beforeEach(() => {
    apiPost.mockReset();
    apiGet.mockReset();
  });

  it('C13 — saveAudioProgressRemote posts the right body', async () => {
    apiPost.mockResolvedValueOnce({ success: true, data: {} });
    await progressService.saveAudioProgressRemote('42', 47, 200, false);
    expect(apiPost).toHaveBeenCalledWith('/content/progress', {
      trackId: 42,
      positionSeconds: 47,
      durationSeconds: 200,
    });
  });

  it('C14 — saveAudioProgressRemote swallows errors', async () => {
    apiPost.mockRejectedValueOnce(new Error('offline'));
    await expect(
      progressService.saveAudioProgressRemote('42', 47, 200, false),
    ).resolves.toBeUndefined();
  });

  it('C14b — saveAudioProgressRemote deletes orphaned local entry on 404', async () => {
    await progressService.saveProgress({
      trackId: '99',
      position: 30,
      completed: false,
      lastPlayed: '2026-05-10T00:00:00Z',
      bookmarks: [],
    });
    apiPost.mockResolvedValueOnce({
      success: false,
      error: 'HTTP 404: Track 99 not found',
    });

    await progressService.saveAudioProgressRemote('99', 30, 100, false);

    expect(await progressService.getProgress('99')).toBeNull();
  });

  it('C15 — getAudioProgressRemote returns parsed payload when row exists', async () => {
    apiGet.mockResolvedValueOnce({
      success: true,
      data: {
        positionSeconds: 47,
        completionPct: 23,
        isCompleted: false,
        lastPlayed: '2026-05-08T10:00:00Z',
      },
    });
    const result = await progressService.getAudioProgressRemote('42');
    expect(result?.positionSeconds).toBe(47);
    expect(result?.lastPlayed).toBe('2026-05-08T10:00:00Z');
  });

  it('C16 — getAudioProgressRemote returns null when no lastPlayed (server zero shape)', async () => {
    apiGet.mockResolvedValueOnce({
      success: true,
      data: { positionSeconds: 0, completionPct: 0, isCompleted: false },
    });
    expect(await progressService.getAudioProgressRemote('42')).toBeNull();
  });

  it('C17 — getAudioProgressRemote returns null on api throw', async () => {
    apiGet.mockRejectedValueOnce(new Error('network'));
    expect(await progressService.getAudioProgressRemote('42')).toBeNull();
  });

  it('C18 — getLastPlayedTrackRemote returns parsed object', async () => {
    apiGet.mockResolvedValueOnce({
      success: true,
      data: {
        trackId: 42,
        positionSeconds: 47,
        durationSeconds: 200,
        isCompleted: false,
        lastPlayed: '2026-05-08T10:00:00Z',
        track: { id: 42, title: 'Track A' },
        session: { id: 7, name: 'Morning' },
        event: { id: 99, titleEn: 'Spring Retreat' },
      },
    });
    const result = await progressService.getLastPlayedTrackRemote();
    expect(result?.trackId).toBe('42');
    expect(result?.meta.retreatName).toBe('Spring Retreat');
  });

  it('C19 — getLastPlayedTrackRemote returns null when server returns null', async () => {
    apiGet.mockResolvedValueOnce({ success: true, data: null });
    expect(await progressService.getLastPlayedTrackRemote()).toBeNull();
  });

  it('C20 — getLastPlayedTrackRemote returns null on api throw', async () => {
    apiGet.mockRejectedValueOnce(new Error('network'));
    expect(await progressService.getLastPlayedTrackRemote()).toBeNull();
  });

  it('C24 — getAllAudioProgressRemote returns parsed array', async () => {
    apiGet.mockResolvedValueOnce({
      success: true,
      data: [
        { trackId: 1, positionSeconds: 47, completionPct: 23, isCompleted: false, lastPlayed: '2026-05-08T10:00:00Z' },
        { trackId: 2, positionSeconds: 12, completionPct: 6, isCompleted: false, lastPlayed: '2026-05-07T10:00:00Z' },
      ],
    });
    const result = await progressService.getAllAudioProgressRemote();
    expect(result).toHaveLength(2);
    expect(result[0].trackId).toBe(1);
    expect(result[0].positionSeconds).toBe(47);
  });

  it('C25 — getAllAudioProgressRemote filters out entries without lastPlayed', async () => {
    apiGet.mockResolvedValueOnce({
      success: true,
      data: [
        { trackId: 1, positionSeconds: 47, completionPct: 23, isCompleted: false, lastPlayed: '2026-05-08T10:00:00Z' },
        { trackId: 2, positionSeconds: 0, completionPct: 0, isCompleted: false, lastPlayed: null },
      ],
    });
    const result = await progressService.getAllAudioProgressRemote();
    expect(result).toHaveLength(1);
    expect(result[0].trackId).toBe(1);
  });

  it('C26 — getAllAudioProgressRemote returns [] on api throw', async () => {
    apiGet.mockRejectedValueOnce(new Error('network'));
    expect(await progressService.getAllAudioProgressRemote()).toEqual([]);
  });
});
