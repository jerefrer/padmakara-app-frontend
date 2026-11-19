import AsyncStorage from '@react-native-async-storage/async-storage';

import { readerStateService, SIGNED_OUT_ACCOUNT } from '../../services/readerStateService';
import apiService from '../../services/apiService';

jest.mock('../../services/apiService', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(() => Promise.resolve({ success: true })),
    delete: jest.fn(() => Promise.resolve({ success: true })),
  },
}));

const api = apiService as unknown as { get: jest.Mock; put: jest.Mock; delete: jest.Mock };

const NOW = Date.parse('2026-11-19T10:00:00.000Z');
const DOC = { type: 'publication' as const, id: '5' };
const USER = '42';

const serverState = (position: { page: number; updatedAt: string } | null, pages: number[] = []) => ({
  success: true,
  data: { position, bookmarks: pages.map((page) => ({ page, createdAt: '2026-11-18T10:00:00.000Z' })) },
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  api.put.mockResolvedValue({ success: true });
  api.delete.mockResolvedValue({ success: true });
});

describe('last page', () => {
  it('should remember the page on this device, and on the server when signed in', async () => {
    await readerStateService.savePosition(DOC, 12, { signedIn: true });

    expect(await readerStateService.getLocalPosition(DOC)).toEqual({ page: 12, at: NOW });
    expect(api.put).toHaveBeenCalledWith('/reader/publication/5/position', {
      page: 12,
      updatedAt: '2026-11-19T10:00:00.000Z',
    });
  });

  it('should not call the server when signed out', async () => {
    await readerStateService.savePosition(DOC, 12, { signedIn: false });

    expect(api.put).not.toHaveBeenCalled();
    expect((await readerStateService.getLocalState(DOC, SIGNED_OUT_ACCOUNT)).position).toEqual({ page: 12, at: NOW });
  });

  it('should keep the page saved before positions had a time, as the oldest', async () => {
    await AsyncStorage.setItem('@publication_position:5', '17');

    expect(await readerStateService.getLocalPosition(DOC)).toEqual({ page: 17, at: 0 });
  });

  it('should open on the page read later on another device', async () => {
    await readerStateService.savePosition(DOC, 12, { signedIn: false });
    api.get.mockResolvedValue(serverState({ page: 40, updatedAt: '2026-11-19T11:00:00.000Z' }));

    const state = await readerStateService.syncWithServer(DOC, USER);

    expect(state?.position).toEqual({ page: 40, at: Date.parse('2026-11-19T11:00:00.000Z') });
    // Kept on the device for the next open offline.
    expect((await readerStateService.getLocalPosition(DOC))?.page).toBe(40);
    expect(api.put).not.toHaveBeenCalled();
  });

  it('should keep this device page when it is the more recent, and send it', async () => {
    await readerStateService.savePosition(DOC, 12, { signedIn: false });
    api.get.mockResolvedValue(serverState({ page: 40, updatedAt: '2026-11-18T09:00:00.000Z' }));

    const state = await readerStateService.syncWithServer(DOC, USER);

    expect(state?.position).toEqual({ page: 12, at: NOW });
    expect(api.put).toHaveBeenCalledWith('/reader/publication/5/position', {
      page: 12,
      updatedAt: '2026-11-19T10:00:00.000Z',
    });
  });

  it('should answer null when the server cannot be reached, leaving the device state', async () => {
    api.get.mockResolvedValue({ success: false, error: 'Network error' });

    expect(await readerStateService.syncWithServer(DOC, USER)).toBeNull();
  });
});

describe('page bookmarks', () => {
  it('should keep a signed-out bookmark on this device only', async () => {
    const pages = await readerStateService.setBookmark(DOC, SIGNED_OUT_ACCOUNT, 12, true);

    expect(pages).toEqual([12]);
    expect(api.put).not.toHaveBeenCalled();
    expect((await readerStateService.getLocalState(DOC, SIGNED_OUT_ACCOUNT)).bookmarks).toEqual([12]);
  });

  it('should not show one account bookmarks to another on the same device', async () => {
    await readerStateService.setBookmark(DOC, SIGNED_OUT_ACCOUNT, 12, true);

    expect((await readerStateService.getLocalState(DOC, USER)).bookmarks).toEqual([]);
  });

  it('should send a signed-in bookmark to the server', async () => {
    const pages = await readerStateService.setBookmark(DOC, USER, 3, true);

    expect(api.put).toHaveBeenCalledWith('/reader/publication/5/bookmarks/3');
    expect(pages).toEqual([3]);
  });

  it('should remove a signed-in bookmark on the server', async () => {
    await readerStateService.setBookmark(DOC, USER, 3, true);

    const pages = await readerStateService.setBookmark(DOC, USER, 3, false);

    expect(api.delete).toHaveBeenCalledWith('/reader/publication/5/bookmarks/3');
    expect(pages).toEqual([]);
  });

  it('should keep a bookmark made offline and send it on the next sync', async () => {
    api.put.mockResolvedValueOnce({ success: false, error: 'Network error' });
    const offline = await readerStateService.setBookmark(DOC, USER, 12, true);
    expect(offline).toEqual([12]);
    // The server has the page once the queued change reaches it.
    api.get.mockImplementation(() =>
      Promise.resolve(serverState(null, api.put.mock.calls.length > 1 ? [3, 12] : [3])),
    );

    const state = await readerStateService.syncWithServer(DOC, USER);

    expect(api.put).toHaveBeenLastCalledWith('/reader/publication/5/bookmarks/12');
    expect(state?.bookmarks).toEqual([3, 12]);
  });

  it('should drop a change the server refuses for good', async () => {
    api.put.mockResolvedValueOnce({ success: false, status: 404, error: 'Document not found' });

    const pages = await readerStateService.setBookmark(DOC, USER, 12, true);

    expect(pages).toEqual([]);
    api.get.mockResolvedValue(serverState(null, []));
    await readerStateService.syncWithServer(DOC, USER);
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  it('should keep a change still unsent when the sync cannot reach the server', async () => {
    api.delete.mockResolvedValue({ success: false, error: 'Network error' });
    api.get.mockResolvedValueOnce(serverState(null, [3, 12]));
    await readerStateService.syncWithServer(DOC, USER);
    await readerStateService.setBookmark(DOC, USER, 12, false);
    api.get.mockResolvedValueOnce({ success: false, error: 'Network error' });

    await readerStateService.syncWithServer(DOC, USER);

    expect((await readerStateService.getLocalState(DOC, USER)).bookmarks).toEqual([3]);
  });
});

describe('listAllBookmarks', () => {
  it('should return the server list of page bookmarks', async () => {
    const bookmark = {
      documentType: 'publication',
      documentId: 5,
      page: 12,
      createdAt: '2026-11-19T10:00:00.000Z',
      document: { type: 'publication', id: 5, title: 'O Tesouro de Bênçãos' },
    };
    api.get.mockResolvedValue({ success: true, data: { bookmarks: [bookmark] } });

    const res = await readerStateService.listAllBookmarks();

    expect(api.get).toHaveBeenCalledWith('/reader/bookmarks');
    expect(res).toEqual({ success: true, data: [bookmark] });
  });
});
