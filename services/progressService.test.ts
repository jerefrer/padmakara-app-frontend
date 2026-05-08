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
