import { renderHook, waitFor, act } from '@testing-library/react-native';

import { useVideoBookmarks } from '@/hooks/useVideoBookmarks';
import videoBookmarkService from '@/services/videoBookmarkService';

let mockAuth: { isAuthenticated: boolean };

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const R = require('react');
    R.useEffect(cb, [cb]);
  },
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/services/videoBookmarkService', () => ({
  __esModule: true,
  default: { list: jest.fn(), add: jest.fn(), remove: jest.fn() },
}));

const service = videoBookmarkService as jest.Mocked<typeof videoBookmarkService>;

const bm = (id: number, videoId: number, positionSeconds = 0, note: string | null = null) =>
  ({ id, videoId, positionSeconds, note }) as any;

beforeEach(() => {
  jest.resetAllMocks();
  mockAuth = { isAuthenticated: true };
  service.list.mockResolvedValue({ success: true, data: [bm(10, 5)] });
});

describe('useVideoBookmarks', () => {
  it('should mark a video as bookmarked when it has a whole-video bookmark', async () => {
    const { result } = renderHook(() => useVideoBookmarks());
    await waitFor(() => expect(result.current.isBookmarked(5)).toBe(true));
    expect(result.current.isBookmarked(6)).toBe(false);
  });

  it('should ignore moment bookmarks and bookmarks with a note', async () => {
    service.list.mockResolvedValue({ success: true, data: [bm(1, 7, 90), bm(2, 8, 0, 'remember this')] });
    const { result } = renderHook(() => useVideoBookmarks());
    await waitFor(() => expect(service.list).toHaveBeenCalled());
    expect(result.current.isBookmarked(7)).toBe(false);
    expect(result.current.isBookmarked(8)).toBe(false);
  });

  it('should not call the API when the user is signed out', () => {
    mockAuth = { isAuthenticated: false };
    const { result } = renderHook(() => useVideoBookmarks());
    expect(result.current.enabled).toBe(false);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('should create a bookmark at position zero without a note when toggled on', async () => {
    service.add.mockResolvedValue({ success: true, data: bm(11, 6) });
    const { result } = renderHook(() => useVideoBookmarks());
    await waitFor(() => expect(service.list).toHaveBeenCalled());

    await act(async () => {
      await result.current.toggle(6);
    });

    expect(service.add).toHaveBeenCalledWith({ videoId: 6, positionSeconds: 0 });
    expect(result.current.isBookmarked(6)).toBe(true);
  });

  it('should show the bookmark immediately, before the server answers', async () => {
    let resolveAdd: (v: any) => void = () => {};
    service.add.mockReturnValue(new Promise((r) => (resolveAdd = r)));
    const { result } = renderHook(() => useVideoBookmarks());
    await waitFor(() => expect(service.list).toHaveBeenCalled());

    act(() => {
      result.current.toggle(6);
    });
    expect(result.current.isBookmarked(6)).toBe(true);

    await act(async () => resolveAdd({ success: true, data: bm(11, 6) }));
  });

  it('should delete the bookmark when toggled off', async () => {
    service.remove.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useVideoBookmarks());
    await waitFor(() => expect(result.current.isBookmarked(5)).toBe(true));

    await act(async () => {
      await result.current.toggle(5);
    });

    expect(service.remove).toHaveBeenCalledWith(10);
    expect(result.current.isBookmarked(5)).toBe(false);
  });

  it('should remove every whole-video bookmark of the video when toggled off', async () => {
    service.list.mockResolvedValue({ success: true, data: [bm(10, 5), bm(12, 5)] });
    service.remove.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useVideoBookmarks());
    await waitFor(() => expect(result.current.isBookmarked(5)).toBe(true));

    await act(async () => {
      await result.current.toggle(5);
    });

    expect(service.remove).toHaveBeenCalledTimes(2);
  });

  it('should revert when creating the bookmark fails', async () => {
    service.add.mockResolvedValue({ success: false, error: 'nope' });
    const { result } = renderHook(() => useVideoBookmarks());
    await waitFor(() => expect(service.list).toHaveBeenCalled());

    await act(async () => {
      await result.current.toggle(6);
    });

    expect(result.current.isBookmarked(6)).toBe(false);
  });

  it('should revert when deleting the bookmark fails', async () => {
    service.remove.mockResolvedValue({ success: false, error: 'nope' });
    const { result } = renderHook(() => useVideoBookmarks());
    await waitFor(() => expect(result.current.isBookmarked(5)).toBe(true));

    await act(async () => {
      await result.current.toggle(5);
    });

    expect(result.current.isBookmarked(5)).toBe(true);
  });

  it('should ignore a second tap while the first is still in flight', async () => {
    let resolveAdd: (v: any) => void = () => {};
    service.add.mockReturnValue(new Promise((r) => (resolveAdd = r)));
    const { result } = renderHook(() => useVideoBookmarks());
    await waitFor(() => expect(service.list).toHaveBeenCalled());

    act(() => {
      result.current.toggle(6);
      result.current.toggle(6);
    });
    await act(async () => resolveAdd({ success: true, data: bm(11, 6) }));

    expect(service.add).toHaveBeenCalledTimes(1);
  });
});
