import { renderHook, waitFor, act } from '@testing-library/react-native';

import { useEventBookmarks } from '@/hooks/useEventBookmarks';
import eventBookmarkService from '@/services/eventBookmarkService';

let mockAuth: { isAuthenticated: boolean };

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const R = require('react');
    R.useEffect(cb, [cb]);
  },
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/services/eventBookmarkService', () => ({
  __esModule: true,
  default: { list: jest.fn(), add: jest.fn(), remove: jest.fn() },
}));

const service = eventBookmarkService as jest.Mocked<typeof eventBookmarkService>;

beforeEach(() => {
  jest.resetAllMocks();
  mockAuth = { isAuthenticated: true };
  service.list.mockResolvedValue({ success: true, data: [{ eventId: 5 } as any] });
});

describe('useEventBookmarks', () => {
  it('should mark events as bookmarked when the user has bookmarked them', async () => {
    const { result } = renderHook(() => useEventBookmarks());
    await waitFor(() => expect(result.current.isBookmarked(5)).toBe(true));
    expect(result.current.isBookmarked(6)).toBe(false);
  });

  it('should not call the API when the user is signed out', () => {
    mockAuth = { isAuthenticated: false };
    const { result } = renderHook(() => useEventBookmarks());
    expect(result.current.enabled).toBe(false);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('should add the bookmark when toggling an unbookmarked event', async () => {
    service.add.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useEventBookmarks());
    await waitFor(() => expect(result.current.isBookmarked(5)).toBe(true));
    await act(async () => {
      await result.current.toggle(6);
    });
    expect(service.add).toHaveBeenCalledWith(6);
    expect(result.current.isBookmarked(6)).toBe(true);
  });

  it('should remove the bookmark when toggling a bookmarked event', async () => {
    service.remove.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useEventBookmarks());
    await waitFor(() => expect(result.current.isBookmarked(5)).toBe(true));
    await act(async () => {
      await result.current.toggle(5);
    });
    expect(service.remove).toHaveBeenCalledWith(5);
    expect(result.current.isBookmarked(5)).toBe(false);
  });

  it('should revert the optimistic change when the request fails', async () => {
    service.add.mockResolvedValue({ success: false, error: 'boom' });
    const { result } = renderHook(() => useEventBookmarks());
    await waitFor(() => expect(result.current.isBookmarked(5)).toBe(true));
    await act(async () => {
      await result.current.toggle(6);
    });
    expect(result.current.isBookmarked(6)).toBe(false);
  });
});
