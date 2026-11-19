import { act, renderHook, waitFor } from '@testing-library/react-native';

import { RESUME_SERVER_WAIT_MS, SAVE_PAGE_DELAY_MS, useReaderDocument } from '@/hooks/useReaderDocument';
import { readerStateService } from '@/services/readerStateService';

const mockAuth = { isAuthenticated: false, user: null as { id: string } | null };
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));

jest.mock('@/services/readerStateService', () => ({
  SIGNED_OUT_ACCOUNT: 'anon',
  readerStateService: {
    getLocalState: jest.fn(),
    syncWithServer: jest.fn(),
    savePosition: jest.fn(() => Promise.resolve()),
    setBookmark: jest.fn(),
  },
}));

const service = readerStateService as unknown as Record<string, jest.Mock>;
const DOC = { type: 'publication' as const, id: '5' };

function signIn() {
  mockAuth.isAuthenticated = true;
  mockAuth.user = { id: '42' };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.isAuthenticated = false;
  mockAuth.user = null;
  service.getLocalState.mockResolvedValue({ position: { page: 12, at: 1000 }, bookmarks: [3] });
  service.setBookmark.mockImplementation((_doc, _account, page: number, on: boolean) =>
    Promise.resolve(on ? [3, page].sort((a, b) => a - b) : [3].filter((p) => p !== page)),
  );
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useReaderDocument — where to open', () => {
  it('should open on the device page when signed out, without asking the server', async () => {
    const { result } = renderHook(() => useReaderDocument(DOC));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.initialPage).toBe(12);
    expect(result.current.bookmarks).toEqual([3]);
    expect(service.syncWithServer).not.toHaveBeenCalled();
    expect(service.getLocalState).toHaveBeenCalledWith(DOC, 'anon');
  });

  it('should open on the merged server page when signed in', async () => {
    signIn();
    service.syncWithServer.mockResolvedValue({ position: { page: 40, at: 2000 }, bookmarks: [3, 40] });

    const { result } = renderHook(() => useReaderDocument(DOC));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.initialPage).toBe(40);
    expect(result.current.bookmarks).toEqual([3, 40]);
    expect(service.syncWithServer).toHaveBeenCalledWith(DOC, '42');
  });

  it('should not wait long for a slow server, and keep the page it opened on when the answer comes', async () => {
    jest.useFakeTimers();
    signIn();
    let answer: (state: unknown) => void = () => {};
    service.syncWithServer.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const { result } = renderHook(() => useReaderDocument(DOC));
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(RESUME_SERVER_WAIT_MS);
    });
    expect(result.current.ready).toBe(true);
    expect(result.current.initialPage).toBe(12);

    await act(async () => answer({ position: { page: 40, at: 2000 }, bookmarks: [3, 40] }));

    expect(result.current.initialPage).toBe(12);
    expect(result.current.bookmarks).toEqual([3, 40]);
  });

  it('should keep a resumed page inside a document that got shorter', async () => {
    const { result } = renderHook(() => useReaderDocument(DOC, { pageCount: 8 }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.initialPage).toBe(8);
  });

  it('should not be ready without a document', () => {
    const { result } = renderHook(() => useReaderDocument(null));

    expect(result.current.ready).toBe(false);
    expect(service.getLocalState).not.toHaveBeenCalled();
  });
});

describe('useReaderDocument — saving the page', () => {
  it('should save the page once the reader stays on it', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useReaderDocument(DOC));

    act(() => {
      result.current.reportPage(13);
      result.current.reportPage(14);
    });
    expect(service.savePosition).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(SAVE_PAGE_DELAY_MS));

    expect(service.savePosition).toHaveBeenCalledTimes(1);
    expect(service.savePosition).toHaveBeenCalledWith(DOC, 14, { signedIn: false });
  });

  it('should save the page at once when the document closes', () => {
    jest.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ doc }: { doc: typeof DOC | null }) => useReaderDocument(doc),
      { initialProps: { doc: DOC as typeof DOC | null } },
    );

    act(() => result.current.reportPage(20));
    rerender({ doc: null });

    expect(service.savePosition).toHaveBeenCalledWith(DOC, 20, { signedIn: false });
  });

  it('should save on the server too when signed in', () => {
    jest.useFakeTimers();
    signIn();
    service.syncWithServer.mockReturnValue(new Promise(() => {}));
    const { result, unmount } = renderHook(() => useReaderDocument(DOC));

    act(() => result.current.reportPage(20));
    unmount();

    expect(service.savePosition).toHaveBeenCalledWith(DOC, 20, { signedIn: true });
  });
});

describe('useReaderDocument — bookmarks', () => {
  it('should show a new bookmark at once and keep it', async () => {
    const { result } = renderHook(() => useReaderDocument(DOC));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => result.current.setBookmark(12, true));

    expect(result.current.bookmarks).toEqual([3, 12]);
    expect(service.setBookmark).toHaveBeenCalledWith(DOC, 'anon', 12, true);
  });

  it('should remove a bookmark', async () => {
    const { result } = renderHook(() => useReaderDocument(DOC));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => result.current.setBookmark(3, false));

    expect(result.current.bookmarks).toEqual([]);
  });
});
